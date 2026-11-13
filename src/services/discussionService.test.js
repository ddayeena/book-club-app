import { beforeEach, expect, test, vi } from 'vitest'
import { discussionService } from './discussionService.js'
import { getSupabase } from './supabaseClient.js'
vi.mock('./supabaseClient.js', () => ({ getSupabase: vi.fn() }))
const rpc = vi.fn()
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: 'id', error: null }); getSupabase.mockReturnValue({ rpc }) })
test('read RPCs have bounded pages and no client recipient/author', async () => {
  await discussionService.list('club', { bookId: 'book', page: 2 })
  expect(rpc).toHaveBeenLastCalledWith('list_club_discussions', { p_club: 'club', p_book: 'book', p_page: 2, p_size: 20 })
  await discussionService.comments('topic'); expect(rpc).toHaveBeenLastCalledWith('list_discussion_comments', { p_discussion: 'topic', p_page: 1, p_size: 20 })
})
test('writes preserve concurrency timestamp microseconds and trim text', async () => {
  const topic = { id: 'd', updated_at: '2026-11-12T12:00:00.123456Z' }
  await discussionService.save('c', { title: ' Тема ', body: ' Текст ', bookId: 'b' }, topic)
  expect(rpc).toHaveBeenLastCalledWith('update_club_discussion', { p_id: 'd', p_title: 'Тема', p_body: 'Текст', p_book: 'b', p_expected: topic.updated_at })
  await discussionService.remove(topic); expect(rpc).toHaveBeenLastCalledWith('delete_club_discussion', { p_id: 'd', p_expected: topic.updated_at })
  await discussionService.saveComment('d', { body: ' Коментар ' }, topic)
  expect(rpc).toHaveBeenLastCalledWith('update_discussion_comment', { p_id: 'd', p_body: 'Коментар', p_expected: topic.updated_at })
  await discussionService.removeComment(topic); expect(rpc).toHaveBeenLastCalledWith('delete_discussion_comment', { p_id: 'd', p_expected: topic.updated_at })
})
test('create calls do not send author or timestamps; invalid data never reaches API', async () => {
  await discussionService.save('c', { title: 'Тема', body: 'Текст' })
  expect(rpc).toHaveBeenLastCalledWith('create_club_discussion', { p_club: 'c', p_title: 'Тема', p_body: 'Текст', p_book: null })
  await discussionService.saveComment('d', { body: 'Текст' }); expect(rpc).toHaveBeenLastCalledWith('create_discussion_comment', { p_discussion: 'd', p_body: 'Текст' })
  rpc.mockClear(); await expect(discussionService.save('c', { title: '', body: '' })).rejects.toMatchObject({ code: 'VALIDATION' }); expect(rpc).not.toHaveBeenCalled()
})
test('abort signals are attached to reads and database errors propagate', async () => {
  const abortSignal = vi.fn().mockResolvedValue({ data: { id: 'd' }, error: null })
  rpc.mockReturnValueOnce({ abortSignal }); const signal = new AbortController().signal
  await discussionService.get('d', { signal }); expect(abortSignal).toHaveBeenCalledWith(signal)
  rpc.mockResolvedValueOnce({ data: null, error: { code: '40001', message: 'stale' } })
  await expect(discussionService.remove({ id: 'd', updated_at: 't' })).rejects.toMatchObject({ code: '40001' })
})
