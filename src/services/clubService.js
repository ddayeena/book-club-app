import { getSupabase } from './supabaseClient.js'
import { ServiceError } from './ServiceError.js'
import { validateClub } from '../domain/clubValidation.js'
import { memberCount } from '../domain/catalogFilters.js'

export async function unwrap(query) {
  const { data, error } = await query
  if (error) {
    const fallback = { '23505': 'Запис уже існує або ви вже учасник клубу.', '42501': 'Немає прав на цю дію.', '55000': 'Стан запису змінився. Оновіть дані.', 'P0002': 'Запис не знайдено.' }
    throw new ServiceError(fallback[error.code] ?? 'Не вдалося виконати запит. Перевірте з’єднання та міграції.', { code: error.code, status: error.status })
  }
  return data
}
export function mapClub(c) {
  return { id: c.id, ownerId: c.owner_id, ownerName: c.owner_name, name: c.name, genre: c.genre,
    description: c.description, currentBook: c.current_book ?? null, nextMeeting: c.next_meeting,
    nextMeetingAt: c.next_meeting_at ?? null, legacyNextMeeting: c.legacy_next_meeting ?? null,
    format: c.format, language: c.language, meetingsPerMonth: c.meetings_per_month,
    membersCount: memberCount(c.members_count), archivedAt: c.archived_at, isMember: c.is_member ?? false }
}
function input(values) {
  const result = validateClub(values)
  if (!result.ok) throw new ServiceError('Перевірте поля клубу.', { code: 'VALIDATION', errors: result.errors })
  const v = result.value
  return { name: v.name, genre: v.genre, description: v.description,
    format: v.format, language: v.language, meetings_per_month: v.meetingsPerMonth }
}
export const clubService = {
  async getAll({ signal } = {}) {
    let query = getSupabase().rpc('list_clubs')
    if (signal) query = query.abortSignal(signal)
    return (await unwrap(query)).map(mapClub)
  },
  async create(values) { return mapClub(await unwrap(getSupabase().rpc('create_club', { p_input: input(values) }))) },
  async update(id, values) { return mapClub(await unwrap(getSupabase().rpc('update_club', { p_id: id, p_input: input(values) }))) },
  async archive(id) { await unwrap(getSupabase().rpc('archive_club', { p_id: id })) },
  async restore(id) { await unwrap(getSupabase().rpc('restore_club', { p_id: id })) },
  async getMembers(id, { signal } = {}) {
    let query = getSupabase().rpc('list_club_members', { p_club: id })
    if (signal) query = query.abortSignal(signal)
    return unwrap(query)
  },
  async removeMember(clubId, userId) { await unwrap(getSupabase().rpc('remove_club_member', { p_club: clubId, p_user: userId })) },
}
