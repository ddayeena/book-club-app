import { getSupabase } from './supabaseClient.js'
import { unwrap } from './clubService.js'
import { ServiceError } from './ServiceError.js'
import { validateDiscussion } from '../domain/discussionValidation.js'

async function rpc(name, args, signal) {
  let query = getSupabase().rpc(name, args)
  if (signal) query = query.abortSignal(signal)
  try { return await unwrap(query) }
  catch (cause) {
    if (cause.code === '40001') throw new ServiceError('Запис уже змінився. Збережіть свій текст і перечитайте актуальні дані.', { code: '40001' })
    throw cause
  }
}
function validated(draft, comment = false) {
  const result = validateDiscussion(draft, comment)
  if (!result.ok) throw new ServiceError('Перевірте поля.', { code: 'VALIDATION', errors: result.errors })
  return result.value
}
// Keep PostgreSQL timestamp strings intact: Date would discard version microseconds.
export const discussionService = {
  list(clubId, { bookId = null, page = 1, signal } = {}) { return rpc('list_club_discussions', { p_club: clubId, p_book: bookId, p_page: page, p_size: 20 }, signal) },
  get(id, { signal } = {}) { return rpc('get_club_discussion', { p_id: id }, signal) },
  comments(id, { page = 1, signal } = {}) { return rpc('list_discussion_comments', { p_discussion: id, p_page: page, p_size: 20 }, signal) },
  async save(clubId, draft, topic = null) {
    const v = validated(draft)
    if (topic) { await rpc('update_club_discussion', { p_id: topic.id, p_title: v.title, p_body: v.body, p_book: v.bookId, p_expected: topic.updated_at }); return topic.id }
    return rpc('create_club_discussion', { p_club: clubId, p_title: v.title, p_body: v.body, p_book: v.bookId })
  },
  remove(topic) { return rpc('delete_club_discussion', { p_id: topic.id, p_expected: topic.updated_at }) },
  saveComment(topicId, draft, comment = null) {
    const v = validated(draft, true)
    return comment ? rpc('update_discussion_comment', { p_id: comment.id, p_body: v.body, p_expected: comment.updated_at })
      : rpc('create_discussion_comment', { p_discussion: topicId, p_body: v.body })
  },
  removeComment(comment) { return rpc('delete_discussion_comment', { p_id: comment.id, p_expected: comment.updated_at }) },
}
