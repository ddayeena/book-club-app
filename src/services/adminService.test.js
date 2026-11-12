import { beforeEach, expect, test, vi } from 'vitest'
import { adminService } from './adminService.js'
import { getSupabase } from './supabaseClient.js'
vi.mock('./supabaseClient.js', () => ({ getSupabase: vi.fn() }))
let client, query, result
beforeEach(() => {
  result = { data: { items: [], total: 0 }, error: null }
  query = { abortSignal: vi.fn(() => query), then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) }
  client = { rpc: vi.fn(() => query) }; getSupabase.mockReturnValue(client)
})
test('lists users using whitelisted filters and bounded page size', async () => {
  const signal = new AbortController().signal
  await adminService.users({ search: 'name', role: 'admin', state: 'blocked', page: 2, password: 'ignored', size: 10000 }, { signal })
  expect(client.rpc).toHaveBeenCalledWith('admin_list_users', { p_search: 'name', p_role: 'admin', p_state: 'blocked', p_page: 2, p_size: 20 })
  expect(query.abortSignal).toHaveBeenCalledWith(signal)
})
test('stats use one RPC; clubs whitelist filters; archive reuses existing RPC', async () => {
  await adminService.stats(); await adminService.clubs({ state: 'archived' }); await adminService.archive('club')
  expect(client.rpc.mock.calls).toEqual([['admin_get_stats', {}], ['admin_list_clubs', { p_search: '', p_state: 'archived', p_page: 1, p_size: 20 }], ['archive_club', { p_id: 'club' }]])
})
test('blocking accepts only ID and boolean, never role or other fields', async () => {
  await adminService.setBlocked('user', true)
  expect(client.rpc).toHaveBeenCalledWith('admin_set_user_blocked', { p_user: 'user', p_blocked: true })
  result = { data: null, error: { code: '42501' } }
  await expect(adminService.setBlocked('user', false)).rejects.toMatchObject({ code: '42501' })
  result = { data: null, error: { code: '55000' } }
  await expect(adminService.setBlocked('admin', true)).rejects.toThrow('Останнього активного адміністратора')
})
test('club details reuse safe list_clubs projection including timestamps and archived records', async () => {
  result.data = [{ id: 'c', name: 'Клуб', owner_id: 'owner', owner_name: 'Власник', members_count: 3,
    archived_at: '2026-11-11', created_at: '2026-11-01', description: 'Опис' }]
  const signal = new AbortController().signal
  expect(await adminService.club('c', { signal })).toMatchObject({ id: 'c', ownerName: 'Власник', membersCount: 3,
    archivedAt: '2026-11-11', createdAt: '2026-11-01' })
  expect(client.rpc).toHaveBeenCalledWith('list_clubs', {})
  expect(query.abortSignal).toHaveBeenCalledWith(signal)
  expect(await adminService.club('missing')).toBeNull()
})
test('user details check admin RPC first, match exact identity and separate owned memberships', async () => {
  const reply = (data) => ({ abortSignal: vi.fn(function () { return this }), then: (resolve, reject) => Promise.resolve({ data, error: null }).then(resolve, reject) })
  client.rpc.mockImplementation((_name, args) => reply(args.p_page === 1
    ? { total: 51, items: Array.from({ length: 50 }, (_, i) => ({ id: 'other-' + i, name: 'target' })) }
    : { total: 51, items: [{ id: 'target', name: 'Reader', role: 'user', is_blocked: false, created_at: '2026-11-11' }] }))
  const own = { id: 'owned', owner_id: 'target', name: 'Own', archived_at: null }
  const joined = { id: 'joined', owner_id: 'someone', name: 'Joined', archived_at: '2026-11-11' }
  const queries = []
  client.from = vi.fn((table) => {
    const builder = reply(table === 'clubs' ? [own] : [{ club_id: 'owned', club: own }, { club_id: 'joined', club: joined }])
    for (const name of ['select', 'eq', 'order', 'range']) builder[name] = vi.fn(() => builder)
    queries.push(builder); return builder
  })
  const signal = new AbortController().signal
  expect(await adminService.user('target', { signal })).toMatchObject({ id: 'target', name: 'Reader', membershipsCount: 2,
    ownedClubs: [{ id: 'owned', name: 'Own' }], joinedClubs: [{ id: 'joined', name: 'Joined', archivedAt: '2026-11-11' }] })
  expect(client.rpc).toHaveBeenCalledTimes(2)
  expect(client.rpc).toHaveBeenCalledWith('admin_list_users', expect.objectContaining({ p_search: 'target', p_role: 'all', p_state: 'all', p_page: 2 }))
  expect(client.from.mock.calls).toEqual([['clubs'], ['club_members']])
  for (const query of queries) { expect(query.abortSignal).toHaveBeenCalledWith(signal); expect(query.range).toHaveBeenCalledWith(0, 99) }
  expect(queries[0].eq).toHaveBeenCalledWith('owner_id', 'target')
  expect(queries[1].eq).toHaveBeenCalledWith('user_id', 'target')
})
test('missing user and permission denial never trigger club or membership reads', async () => {
  client.from = vi.fn()
  expect(await adminService.user('missing')).toBeNull()
  expect(client.from).not.toHaveBeenCalled()
  result = { data: null, error: { code: '42501' } }
  await expect(adminService.user('someone')).rejects.toMatchObject({ code: '42501' })
  expect(client.from).not.toHaveBeenCalled()
})
test('club member page uses one authorized RPC with stable pagination and safe projection', async () => {
  query.order = vi.fn(() => query); query.range = vi.fn(() => query)
  result.data = Array.from({ length: 21 }, (_, index) => ({ user_id: String(index), name: 'Reader ' + index, avatar_path: 'unused', joined_at: 'unused' }))
  const signal = new AbortController().signal
  const page = await adminService.members('club', { offset: 20, signal })
  expect(client.rpc).toHaveBeenCalledTimes(1)
  expect(client.rpc).toHaveBeenCalledWith('list_club_members', { p_club: 'club' })
  expect(query.order.mock.calls).toEqual([['joined_at'], ['user_id']])
  expect(query.range).toHaveBeenCalledWith(20, 40)
  expect(query.abortSignal).toHaveBeenCalledWith(signal)
  expect(page.hasMore).toBe(true); expect(page.items).toHaveLength(20)
  expect(page.items[0]).toEqual({ id: '0', name: 'Reader 0' })
  result.data = []
  expect(await adminService.members('club')).toEqual({ items: [], hasMore: false })
  result = { data: null, error: { code: '42501' } }
  await expect(adminService.members('club')).rejects.toMatchObject({ code: '42501' })
})
