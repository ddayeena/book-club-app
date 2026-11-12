import { getSupabase } from './supabaseClient.js'
import { unwrap } from './clubService.js'
import { ServiceError } from './ServiceError.js'
import { validateMeeting } from '../domain/meetingValidation.js'

export function mapMeeting(m) {
  return { id: m.id, clubId: m.club_id, title: m.title, startsAt: m.starts_at, timezone: m.timezone,
    format: m.format, location: m.location, meetingUrl: m.meeting_url, description: m.description,
    cancelledAt: m.cancelled_at, cancelReason: m.cancel_reason, createdAt: m.created_at, updatedAt: m.updated_at,
    serverNow: m.server_now, status: m.status, canManage: Boolean(m.can_manage) }
}
async function rpc(name, args, signal) {
  let query = getSupabase().rpc(name, args)
  if (signal) query = query.abortSignal(signal)
  try { return await unwrap(query) }
  catch (cause) {
    if (cause.code === '40001') throw new ServiceError('Зустріч уже змінено в іншій вкладці. Оновіть дані перед повторною спробою.', { code: '40001' })
    throw cause
  }
}
export const meetingService = {
  async list(clubId, { status = 'upcoming', page = 1, signal } = {}) {
    const data = await rpc('list_club_meetings', { p_club: clubId, p_status: status, p_page: page, p_size: 20 }, signal)
    return { items: data.items.map(mapMeeting), total: Number(data.total), serverNow: data.server_now }
  },
  async get(id, { signal } = {}) { return mapMeeting(await rpc('get_club_meeting', { p_id: id }, signal)) },
  async save(clubId, draft, meeting = null) {
    const validation = validateMeeting(draft, meeting)
    if (!validation.ok) throw new ServiceError('Перевірте поля зустрічі.', { code: 'VALIDATION', errors: validation.errors })
    const row = meeting
      ? await rpc('update_club_meeting', { p_id: meeting.id, p_input: validation.value, p_expected: meeting.updatedAt })
      : await rpc('create_club_meeting', { p_club: clubId, p_input: validation.value })
    return mapMeeting(row)
  },
  async cancel(meeting) { await rpc('cancel_club_meeting', { p_id: meeting.id, p_expected: meeting.updatedAt }) },
}

