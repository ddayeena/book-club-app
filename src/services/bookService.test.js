import { beforeEach, expect, test, vi } from 'vitest'
import { bookService } from './bookService.js'
import { getSupabase } from './supabaseClient.js'
vi.mock('./supabaseClient.js', () => ({ getSupabase: vi.fn() }))
let client
let query
let response
const row = { id: 'b', club_id: 'c', title: 'Книга', author: 'Автор', status: 'planned', is_migrated: false }
beforeEach(() => {
  response = { data: row, error: null }
  query = { then(resolve, reject) { return Promise.resolve(response).then(resolve, reject) },
    select: vi.fn(() => query), eq: vi.fn(() => query), order: vi.fn(() => query), abortSignal: vi.fn(() => query) }
  client = { from: vi.fn(() => query), rpc: vi.fn(() => query) }
  getSupabase.mockReturnValue(client)
})
test('читає книги конкретного клубу з підтримкою скасування', async () => {
  response.data = [row]
  const signal = new AbortController().signal
  expect(await bookService.getAll('c', { signal })).toMatchObject([{ id: 'b', clubId: 'c' }])
  expect(query.eq).toHaveBeenCalledWith('club_id', 'c')
  expect(query.abortSignal).toHaveBeenCalledWith(signal)
})
test('службові поля не передаються із форми', async () => {
  await bookService.save('c', { title: 'Книга', author: 'Автор', status: 'current', isMigrated: true, clubId: 'forged' })
  expect(client.rpc).toHaveBeenCalledWith('save_club_book', { p_club: 'c', p_id: null,
    p_input: { title: 'Книга', author: 'Автор', description: null, cover_url: null } })
})
test('відхиляє нову книгу без автора до RPC', async () => {
  await expect(bookService.save('c', { title: 'Книга' })).rejects.toMatchObject({ code: 'VALIDATION' })
  expect(client.rpc).not.toHaveBeenCalled()
})
test('передає явне рішення та очікувану поточну книгу', async () => {
  await bookService.start('next', 'previous', 'completed')
  expect(client.rpc).toHaveBeenCalledWith('start_club_book', { p_id: 'next', p_previous_id: 'previous', p_previous_action: 'completed' })
})
test('помилка сервера не створює локального fallback', async () => {
  response = { data: null, error: { code: '42501' } }
  await expect(bookService.complete('b')).rejects.toMatchObject({ code: '42501' })
})
test('merges server voting annotations by book id and propagates annotation errors', async () => {
  response.data = [row]
  client.rpc.mockResolvedValueOnce({ data: [{ book_id: 'b', is_poll_locked: true, is_next_selected: true }], error: null })
  expect(await bookService.getAll('c')).toMatchObject([{ id: 'b', isPollLocked: true, isNextSelected: true }])
  expect(client.rpc).toHaveBeenCalledWith('get_club_book_flags', { p_club: 'c' })
  client.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501' } })
  await expect(bookService.getAll('c')).rejects.toMatchObject({ code: '42501' })
})
