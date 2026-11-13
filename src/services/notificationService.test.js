import { beforeEach, expect, test, vi } from 'vitest'
import { notificationService, mapNotification } from './notificationService.js'
import { getSupabase } from './supabaseClient.js'
vi.mock('./supabaseClient.js', () => ({ getSupabase: vi.fn() }))
let result, query, client
beforeEach(() => {
  result = { data: 3, error: null }
  query = { then: (resolve) => Promise.resolve(result).then(resolve), abortSignal: vi.fn(() => query) }
  client = { rpc: vi.fn(() => query) }; getSupabase.mockReturnValue(client)
})
test('counts/list use bounded server-owned identity RPCs and abort signals', async () => {
  const signal = new AbortController().signal
  expect(await notificationService.count({ signal })).toBe(3)
  expect(client.rpc).toHaveBeenCalledWith('get_my_unread_notification_count', {})
  expect(query.abortSignal).toHaveBeenCalledWith(signal)
  result.data = { items: [{ id: 'n', type: 'meeting_reminder', is_stale: true, target: '/clubs/c/meetings/m' }], total: 1, unread_count: 3 }
  expect(await notificationService.list({ filter: 'unread', page: 2, recipient_id: 'forged' })).toMatchObject({ total: 1, unreadCount: 3, items: [{ isStale: true }] })
  expect(client.rpc).toHaveBeenLastCalledWith('list_my_notifications', { p_filter: 'unread', p_page: 2, p_size: 20 })
})
test('mark read sends only ID, never user or client time', async () => {
  result.data = { id: 'n', read_at: '2026-11-12T12:00Z', unread_count: 2 }
  expect(await notificationService.markRead('n')).toMatchObject({ id: 'n', unreadCount: 2 })
  expect(client.rpc).toHaveBeenCalledWith('mark_notification_read', { p_id: 'n' })
})
test.each([undefined, null, '', true, 'bad', -1, 1.5])('invalid count %s is an error, not zero', async (data) => {
  result.data = data
  await expect(notificationService.count()).rejects.toBeTruthy()
})
test('only typed internal targets are navigable and content is kept as text', () => {
  for (const target of ['https://evil.test','//evil.test','javascript:bad','/admin','/clubs/c']) expect(mapNotification({ target }).target).toBeNull()
  for (const target of ['/requests/r', '/clubs/c/requests', '/clubs/c/meetings/m']) expect(mapNotification({ target }).target).toBe(target)
})
