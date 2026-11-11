import { getSupabase } from './supabaseClient.js'
import { unwrap } from './clubService.js'
import { ServiceError } from './ServiceError.js'
import { validateBook } from '../domain/bookValidation.js'

export function mapBook(b) {
  return { id: b.id, clubId: b.club_id, title: b.title, author: b.author, description: b.description,
    coverUrl: b.cover_url, status: b.status, isMigrated: b.is_migrated,
    startedAt: b.started_at, completedAt: b.completed_at }
}
export const bookService = {
  async getAll(clubId, { signal } = {}) {
    let query = getSupabase().from('club_books').select('*').eq('club_id', clubId).order('created_at')
    if (signal) query = query.abortSignal(signal)
    return (await unwrap(query)).map(mapBook)
  },
  async save(clubId, draft, book = null) {
    const result = validateBook(draft, Boolean(book?.isMigrated))
    if (!result.ok) throw new ServiceError('Перевірте поля книги.', { code: 'VALIDATION', errors: result.errors })
    const v = result.value
    return mapBook(await unwrap(getSupabase().rpc('save_club_book', {
      p_club: clubId, p_id: book?.id ?? null,
      p_input: { title: v.title, author: v.author, description: v.description, cover_url: v.coverUrl },
    })))
  },
  async start(id, previousId = null, previousAction = null) {
    return mapBook(await unwrap(getSupabase().rpc('start_club_book', {
      p_id: id, p_previous_id: previousId, p_previous_action: previousAction,
    })))
  },
  async complete(id) { return mapBook(await unwrap(getSupabase().rpc('complete_club_book', { p_id: id }))) },
}
