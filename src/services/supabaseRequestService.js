import { getSupabase } from './supabaseClient.js'
import { unwrap } from './clubService.js'
import { currentUserId } from './authService.js'
import { toRequestInput } from './requestContract.js'
import { ServiceError } from './ServiceError.js'

export function mapRequest(r) {
  return { id: r.id, clubId: r.club_id, ownerId: r.applicant_id, motivation: r.motivation,
    weeklyHours: r.weekly_hours, wantsReminders: r.wants_reminders, experience: r.experience,
    participationFormat: r.participation_format, contactEmail: r.contact_email, createdAt: r.created_at,
    status: r.status, reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at, decisionComment: r.decision_comment }
}
function input(values) {
  const v = toRequestInput(values, [{ id: values.clubId }])
  return { club_id: v.clubId, motivation: v.motivation, weekly_hours: v.weeklyHours,
    wants_reminders: v.wantsReminders, experience: v.experience, participation_format: v.participationFormat, contact_email: v.contactEmail }
}
function actor() {
  const id = currentUserId()
  if (!id) throw new ServiceError('Увійдіть, щоб працювати із заявками.', { code: 'UNAUTHORIZED' })
  return id
}
export const supabaseRequestService = {
  async getAll({ signal } = {}) {
    let query = getSupabase().from('join_requests').select('*').eq('applicant_id', actor()).order('created_at', { ascending: false })
    if (signal) query = query.abortSignal(signal)
    return (await unwrap(query)).map(mapRequest)
  },
  async getIncoming(clubId, { signal } = {}) {
    actor()
    let query = getSupabase().from('join_requests').select('*').eq('club_id', clubId).order('created_at', { ascending: false })
    if (signal) query = query.abortSignal(signal)
    return (await unwrap(query)).map(mapRequest)
  },
  async getById(id) { return mapRequest(await unwrap(getSupabase().from('join_requests').select('*').eq('id', id).single())) },
  async create(values) { return mapRequest(await unwrap(getSupabase().rpc('submit_join_request', { p_input: input(values) }))) },
  async update(id, values) { return mapRequest(await unwrap(getSupabase().rpc('update_join_request', { p_id: id, p_input: input(values) }))) },
  async delete(id) { return mapRequest(await unwrap(getSupabase().rpc('cancel_join_request', { p_id: id }))) },
  async review(id, decision, comment = '') { return mapRequest(await unwrap(getSupabase().rpc('review_join_request', { p_id: id, p_decision: decision, p_comment: comment }))) },
}
