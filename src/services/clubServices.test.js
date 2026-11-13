import { beforeEach, expect, test, vi } from 'vitest'
import { clubService, mapClub } from './clubService.js'
import { supabaseRequestService } from './supabaseRequestService.js'
import { getSupabase } from './supabaseClient.js'
import { setActiveUser } from './authService.js'
import { ownClub, validInput } from '../test/fixtures.js'

vi.mock('./supabaseClient.js', () => ({ getSupabase: vi.fn() }))
let client
let response
let query
const row = { id: 'remote-club', owner_id: 'auth-a', name: 'Клуб', members_count: 3, archived_at: null }
const request = { id: 'remote-request', club_id: 'remote-club', applicant_id: 'auth-a', status: 'pending' }
test('unknown participant count is not replaced with a fabricated owner count', () => {
  for (const members_count of [undefined, null, '', 'bad', -1, Infinity, 2.5]) expect(mapClub({ ...row, members_count }).membersCount).toBeNull()
  expect(mapClub({ ...row, members_count: 0 }).membersCount).toBe(0)
  expect(mapClub(row).membersCount).toBe(3)
})
beforeEach(() => {
  setActiveUser({ id: 'auth-a' })
  response = { data: row, error: null }
  query = {
    then(resolve, reject) { return Promise.resolve(response).then(resolve, reject) },
    abortSignal: vi.fn(() => query), select: vi.fn(() => query), eq: vi.fn(() => query),
    order: vi.fn(() => query), single: vi.fn(() => query),
  }
  client = { rpc: vi.fn(() => query), from: vi.fn(() => query) }
  getSupabase.mockReturnValue(client)
})
test('каталог читає лише Supabase, не локальні чи демонстраційні записи', async () => {
  localStorage.setItem('bookclub.clubs.v1', JSON.stringify([ownClub]))
  response.data = [row]
  expect(await clubService.getAll()).toMatchObject([{ id: 'remote-club', membersCount: 3 }])
  expect(client.rpc).toHaveBeenCalledWith('list_clubs')
  expect(localStorage.getItem('bookclub.clubs.v1')).toBe(JSON.stringify([ownClub]))
})
test('створення клубу не передає ID власника та кількість учасників', async () => {
  await clubService.create({ ...ownClub, ownerId: 'forged' })
  const args = client.rpc.mock.calls[0][1].p_input
  expect(args).not.toHaveProperty('owner_id')
  expect(args).not.toHaveProperty('members_count')
  expect(args).toMatchObject({ name: ownClub.name })
  expect(args).not.toHaveProperty('current_book')
})
test('архівування викликає RPC, не фізичне видалення', async () => {
  await clubService.archive('remote-club')
  expect(client.rpc).toHaveBeenCalledWith('archive_club', { p_id: 'remote-club' })
})

test('відновлення викликає вузький RPC і передає помилки доступу', async () => {
  await clubService.restore('remote-club')
  expect(client.rpc).toHaveBeenCalledWith('restore_club', { p_id: 'remote-club' })
  response = { data: null, error: { code: '42501' } }
  await expect(clubService.restore('remote-club')).rejects.toMatchObject({ code: '42501' })
})

test('форма клубу не передає окрему дату до RPC', async () => {
  await clubService.create({ ...ownClub, nextMeeting: '' })
  expect(client.rpc.mock.calls[0][1].p_input).not.toHaveProperty('next_meeting')
})

test('каталог зберігає currentBook із похідного поля RPC після перенесення', async () => {
  response.data = [{ ...row, current_book: 'Стара збережена назва' }]
  expect(await clubService.getAll()).toMatchObject([{ currentBook: 'Стара збережена назва' }])
})

test('редагування клубу не переписує книгу, перенесену на полицю', async () => {
  await clubService.update('remote-club', { ...ownClub, currentBook: 'Стара збережена назва' })
  expect(client.rpc.mock.calls[0][1].p_input).not.toHaveProperty('current_book')
})
test('мої заявки завжди мають явний фільтр автора', async () => {
  response.data = [request]
  expect(await supabaseRequestService.getAll()).toMatchObject([{ ownerId: 'auth-a', status: 'pending' }])
  expect(query.eq).toHaveBeenCalledWith('applicant_id', 'auth-a')
})
test('запит без Auth не завантажує приватну колекцію', async () => {
  setActiveUser(null)
  await expect(supabaseRequestService.getAll()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  expect(query.eq).not.toHaveBeenCalled()
})
test('заявка на віддалений клуб не перевіряється локальним каталогом', async () => {
  response.data = request
  await supabaseRequestService.create({ ...validInput, clubId: 'remote-club', ownerId: 'forged', status: 'approved' })
  expect(client.rpc).toHaveBeenCalledWith('submit_join_request', { p_input: expect.objectContaining({ club_id: 'remote-club' }) })
  expect(client.rpc.mock.calls[0][1].p_input).not.toHaveProperty('status')
  expect(client.rpc.mock.calls[0][1].p_input).not.toHaveProperty('applicant_id')
})
test('скасування зберігає серверний запис зі статусом', async () => {
  response.data = { ...request, status: 'cancelled' }
  expect(await supabaseRequestService.delete(request.id)).toMatchObject({ status: 'cancelled' })
  expect(client.rpc).toHaveBeenCalledWith('cancel_join_request', { p_id: request.id })
})
test('схвалення не намагається створити членство на клієнті', async () => {
  response.data = { ...request, status: 'approved' }
  await supabaseRequestService.review(request.id, 'approved', 'Вітаємо')
  expect(client.rpc).toHaveBeenCalledWith('review_join_request', { p_id: request.id, p_decision: 'approved', p_comment: 'Вітаємо' })
  expect(client.from).not.toHaveBeenCalled()
})
test('відмова RLS не перетворюється на порожній список або mock fallback', async () => {
  response = { data: null, error: { code: '42501' } }
  await expect(clubService.getAll()).rejects.toMatchObject({ code: '42501' })
})
test('читання підтримує AbortSignal', async () => {
  response.data = []
  const controller = new AbortController()
  await clubService.getAll({ signal: controller.signal })
  expect(query.abortSignal).toHaveBeenCalledWith(controller.signal)
})

test('вихід викликає наявний RPC членства без зміни заявок', async () => {
  response.data = null
  await clubService.removeMember('remote-club', 'auth-a')
  expect(client.rpc).toHaveBeenCalledWith('remove_club_member', { p_club: 'remote-club', p_user: 'auth-a' })
  expect(client.from).not.toHaveBeenCalled()
})
