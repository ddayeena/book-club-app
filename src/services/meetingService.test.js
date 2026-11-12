import { beforeEach, expect, test, vi } from 'vitest'
import { meetingService } from './meetingService.js'
import { getSupabase } from './supabaseClient.js'
import { localDateTime } from '../domain/meetingValidation.js'
vi.mock('./supabaseClient.js', () => ({ getSupabase: vi.fn() }))
let result, query, client
const row = { id: 'm', club_id: 'c', title: 'Зустріч', starts_at: '2099-06-10T12:00Z', timezone: 'UTC', updated_at: '2026-11-12T12:00:00.123456Z', can_manage: true, status: 'upcoming' }
const draft = { title: 'Зустріч', localTime: '2099-06-10T12:00', format: 'online', meetingUrl: 'https://example.test', location: '' }
beforeEach(() => {
  vi.resetAllMocks(); result = { data: row, error: null }
  query = { then: (resolve) => Promise.resolve(result).then(resolve), abortSignal: vi.fn(() => query) }
  client = { rpc: vi.fn(() => query) }; getSupabase.mockReturnValue(client)
})
test('get and paginated list use abortable RPCs', async () => {
  const signal = new AbortController().signal
  expect(await meetingService.get('m', { signal })).toMatchObject({ id: 'm', canManage: true, updatedAt: row.updated_at })
  expect(query.abortSignal).toHaveBeenCalledWith(signal)
  result.data = { items: [row], total: 1, server_now: '2026-11-12T12:00Z' }
  expect(await meetingService.list('c', { status: 'past', page: 2 })).toMatchObject({ total: 1, items: [{ clubId: 'c' }] })
  expect(client.rpc).toHaveBeenLastCalledWith('list_club_meetings', { p_club: 'c', p_status: 'past', p_page: 2, p_size: 20 })
})
test('create whitelists input and update/cancel preserve full timestamp precision', async () => {
  await meetingService.save('c', { ...draft, club_id: 'forged', cancelled_at: 'forged' })
  const input = client.rpc.mock.calls[0][1].p_input
  expect(input.starts_at).toMatch(/Z$/); expect(input).not.toHaveProperty('club_id'); expect(input).not.toHaveProperty('cancelled_at')
  const meeting = { id: 'm', updatedAt: row.updated_at }
  await meetingService.save('c', draft, meeting)
  expect(client.rpc).toHaveBeenLastCalledWith('update_club_meeting', expect.objectContaining({ p_id: 'm', p_expected: row.updated_at }))
  await meetingService.cancel(meeting)
  expect(client.rpc).toHaveBeenLastCalledWith('cancel_club_meeting', { p_id: 'm', p_expected: row.updated_at })
})
test('invalid input avoids a request and stale updates give a useful error', async () => {
  await expect(meetingService.save('c', { ...draft, meetingUrl: 'javascript:bad' })).rejects.toMatchObject({ code: 'VALIDATION' })
  expect(client.rpc).not.toHaveBeenCalled()
  result = { error: { code: '40001' } }
  await expect(meetingService.cancel({ id: 'm', updatedAt: row.updated_at })).rejects.toMatchObject({ code: '40001', message: expect.stringContaining('іншій вкладці') })
})

test('editing a title preserves exact start instant and original timezone', async () => {
  const meeting = { id: 'm', updatedAt: row.updated_at, startsAt: '2099-06-10T12:00:45.123456+00:00', timezone: 'Pacific/Auckland' }
  await meetingService.save('c', { ...draft, title: 'Нова назва', localTime: localDateTime(meeting.startsAt) }, meeting)
  expect(client.rpc).toHaveBeenLastCalledWith('update_club_meeting', expect.objectContaining({
    p_input: expect.objectContaining({ starts_at: meeting.startsAt, timezone: meeting.timezone }), p_expected: row.updated_at,
  }))
  await meetingService.save('c', { ...draft, localTime: '2099-06-11T12:00' }, meeting)
  expect(client.rpc.mock.calls.at(-1)[1].p_input).toMatchObject({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
  expect(client.rpc.mock.calls.at(-1)[1].p_input.starts_at).not.toBe(meeting.startsAt)
})

