import { getSupabase } from './supabaseClient.js'
import { mapClub, unwrap } from './clubService.js'
import { ServiceError } from './ServiceError.js'

const pageArgs = (input) => ({ p_search: input.search ?? '', p_state: input.state ?? 'all', p_page: input.page ?? 1, p_size: 20 })
export const adminService = {
  stats: ({ signal } = {}) => read('admin_get_stats', {}, signal),
  users: (input, { signal } = {}) => read('admin_list_users', { ...pageArgs(input), p_role: input.role ?? 'all' }, signal),
  clubs: (input, { signal } = {}) => read('admin_list_clubs', pageArgs(input), signal),
  async members(clubId, { offset = 0, signal } = {}) {
    // One existing RPC per page; fetch one extra row to detect the next page.
    let query = getSupabase().rpc('list_club_members', { p_club: clubId })
      .order('joined_at').order('user_id').range(offset, offset + 20)
    if (signal) query = query.abortSignal(signal)
    const rows = await unwrap(query)
    return { items: rows.slice(0, 20).map((row) => ({ id: row.user_id, name: row.name })), hasMore: rows.length > 20 }
  },
  async user(id, { signal } = {}) {
    // The existing admin RPC checks the DB role before any club reads.
    // Search also matches names: require an exact ID and examine all matching pages.
    let profile
    for (let page = 1; ; page += 1) {
      const result = await read('admin_list_users', { p_search: id, p_role: 'all', p_state: 'all', p_page: page, p_size: 50 }, signal)
      profile = result.items.find((row) => row.id === id)
      if (profile || page * 50 >= Number(result.total) || !result.items.length) break
    }
    if (!profile) return null
    const client = getSupabase()
    const columns = 'id,name,owner_id,archived_at'
    const [owned, memberships] = await Promise.all([
      collectRows(() => client.from('clubs').select(columns).eq('owner_id', id).order('id'), signal),
      collectRows(() => client.from('club_members').select(`club_id,club:clubs(${columns})`).eq('user_id', id).order('club_id'), signal),
    ])
    const membershipIds = new Set(memberships.map((row) => row.club_id))
    const joined = memberships.map((row) => row.club).filter((club) => club && club.owner_id !== id)
    return { id: profile.id, name: profile.name, role: profile.role, isBlocked: profile.is_blocked, createdAt: profile.created_at,
      ownedClubs: owned.map(mapUserClub), joinedClubs: joined.map(mapUserClub), membershipsCount: membershipIds.size }
  },
  async club(id, { signal } = {}) {
    // Existing safe catalog projection includes archived clubs for active admins.
    const rows = await read('list_clubs', {}, signal)
    const row = rows.find((club) => club.id === id)
    return row ? { ...mapClub(row), createdAt: row.created_at } : null
  },
  async setBlocked(id, blocked) {
    try { return await read('admin_set_user_blocked', { p_user: id, p_blocked: blocked }) }
    catch (cause) {
      if (cause.code === '55000') throw new ServiceError('Останнього активного адміністратора не можна заблокувати.', { code: cause.code })
      throw cause
    }
  },
  archive: (id) => read('archive_club', { p_id: id }),
  restore: (id) => read('restore_club', { p_id: id }),
}
async function read(name, args, signal) {
  let query = getSupabase().rpc(name, args)
  if (signal) query = query.abortSignal(signal)
  return unwrap(query)
}
function mapUserClub(club) { return { id: club.id, name: club.name, archivedAt: club.archived_at } }
async function collectRows(makeQuery, signal) {
  const rows = []
  for (let offset = 0; ; offset += 100) {
    let query = makeQuery().range(offset, offset + 99)
    if (signal) query = query.abortSignal(signal)
    const page = await unwrap(query)
    rows.push(...page)
    if (page.length < 100) return rows
  }
}
