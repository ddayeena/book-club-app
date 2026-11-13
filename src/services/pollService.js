import { getSupabase } from './supabaseClient.js'
import { unwrap } from './clubService.js'
import { ServiceError } from './ServiceError.js'
import { validatePoll } from '../domain/pollValidation.js'

export function mapPoll(p) {
  return { id: p.id, clubId: p.club_id, title: p.title, endsAt: p.ends_at, serverNow: p.server_now,
    receivedAt: Date.now(), status: p.status, finalizedAt: p.finalized_at, cancelledAt: p.cancelled_at,
    cancelReason: p.cancel_reason, selectionConsumedAt: p.selection_consumed_at,
    winnerOptionId: p.winner_option_id, myOptionId: p.my_option_id, totalVotes: Number(p.total_votes),
    canVote: p.can_vote, canFinalize: p.can_finalize, canCancel: p.can_cancel,
    options: (p.options ?? []).map((o) => ({ id: o.id, bookId: o.book_id, title: o.title, author: o.author, votes: Number(o.votes) })) }
}
async function rpc(name, params, signal) {
  let query = getSupabase().rpc(name, params)
  if (signal) query = query.abortSignal(signal)
  return unwrap(query)
}
export const pollService = {
  async list(clubId, { signal } = {}) { return (await rpc('list_book_polls', { p_club: clubId }, signal)).map(mapPoll) },
  async get(id, { signal } = {}) { return mapPoll(await rpc('get_book_poll', { p_id: id }, signal)) },
  async create(clubId, draft) {
    const result = validatePoll(draft)
    if (!result.ok) throw new ServiceError('Перевірте поля голосування.', { code: 'VALIDATION', errors: result.errors })
    const v = result.value
    return rpc('create_book_poll', { p_club: clubId, p_title: v.title, p_ends_at: v.endsAt, p_books: v.bookIds })
  },
  vote(id, optionId) { return rpc('cast_book_vote', { p_poll: id, p_option: optionId }) },
  finalize(id, optionId) { return rpc('finalize_book_poll', { p_poll: id, p_option: optionId }) },
  cancel(id) { return rpc('cancel_book_poll', { p_poll: id }) },
}
