import { beforeEach, expect, test, vi } from 'vitest'
import { pollService } from './pollService.js'
import { getSupabase } from './supabaseClient.js'
vi.mock('./supabaseClient.js', () => ({ getSupabase: vi.fn() }))
const row = { id: 'p', club_id: 'c', title: 'Наступна книга', ends_at: '2099-01-01T00:00Z',
  server_now: '2026-11-11T10:00Z', status: 'open', total_votes: 2, can_vote: true,
  options: [{ id: 'o', book_id: 'b', title: 'Книга', votes: 2 }], my_option_id: 'o' }
let client, query, result
beforeEach(() => {
  result = { data: row, error: null }
  query = { abortSignal: vi.fn(() => query), then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) }
  client = { rpc: vi.fn(() => query) }; getSupabase.mockReturnValue(client)
})
test('restores server permissions, own choice and aggregate results after reload', async () => {
  const signal = new AbortController().signal
  expect(await pollService.get('p', { signal })).toMatchObject({ clubId: 'c', myOptionId: 'o', canVote: true,
    totalVotes: 2, options: [{ bookId: 'b', votes: 2 }] })
  expect(query.abortSignal).toHaveBeenCalledWith(signal)
  result.data = [row]
  expect(await pollService.list('c')).toHaveLength(1)
})
test('creation whitelists arguments and rejects invalid drafts before RPC', async () => {
  await expect(pollService.create('c', { title: 'Нова', endsAt: '2099-01-01', bookIds: ['a'] })).rejects.toMatchObject({ code: 'VALIDATION' })
  expect(client.rpc).not.toHaveBeenCalled()
  await pollService.create('c', { title: ' Нова ', endsAt: '2099-01-01T00:00Z', bookIds: ['a', 'b'], userId: 'forged', winner: 'a' })
  expect(client.rpc).toHaveBeenCalledWith('create_book_poll', { p_club: 'c', p_title: 'Нова', p_ends_at: '2099-01-01T00:00:00.000Z', p_books: ['a', 'b'] })
})
test('vote, finalization and cancellation never accept an author or club override', async () => {
  await pollService.vote('p', 'o'); await pollService.finalize('p', 'o'); await pollService.cancel('p')
  expect(client.rpc.mock.calls).toEqual([['cast_book_vote', { p_poll: 'p', p_option: 'o' }],
    ['finalize_book_poll', { p_poll: 'p', p_option: 'o' }], ['cancel_book_poll', { p_poll: 'p' }]])
})
test('server denial remains an error without local fallback', async () => {
  result = { data: null, error: { code: '42501' } }
  await expect(pollService.vote('p', 'o')).rejects.toMatchObject({ code: '42501' })
})
