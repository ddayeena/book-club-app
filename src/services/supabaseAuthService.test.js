import { beforeEach, expect, test, vi } from 'vitest'
import { getSupabase } from './supabaseClient.js'
import * as service from './authService.js'

vi.mock('./supabaseClient.js', () => ({ getSupabase: vi.fn() }))
const session = { user: { id: 'auth-user', email: 'reader@example.com' } }
let client
let profile
let access
beforeEach(() => {
  service.setActiveUser(null)
  profile = { data: { id: 'auth-user', name: 'Читач', reminders_enabled: false }, error: null }
  access = { data: { role: 'user', is_blocked: false }, error: null }
  client = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn((table) => ({ select: () => ({ eq: () => ({ single: async () => table === 'profiles' ? profile : access }) }) })),
  }
  getSupabase.mockReturnValue(client)
})

test('відновлює Supabase-сеанс і читає роль з БД, а не метаданих', async () => {
  const restored = await service.getSession()
  const user = await service.getSessionUser(restored)
  expect(user).toMatchObject({ id: 'auth-user', role: 'user', name: 'Читач' })
  expect(client.from.mock.calls).toEqual([['profiles'], ['user_access']])
})
test('реєстрація очікує підтвердження пошти та не передає роль', async () => {
  expect(await service.register({ name: ' Читач ', email: 'READER@example.com', password: 'secret123', role: 'admin' })).toBeNull()
  expect(client.auth.signUp).toHaveBeenCalledWith({ email: 'reader@example.com', password: 'secret123', options: { data: { name: 'Читач' }, emailRedirectTo: window.location.origin + '/login' } })
})
test('вхід нормалізує поля й не приймає службові значення', async () => {
  await service.login({ email: ' READER@example.com ', password: 'secret123', role: 'admin' })
  expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'reader@example.com', password: 'secret123' })
})
test.each(['invalid_credentials', 'email_not_confirmed', 'over_email_send_rate_limit'])('помилка Auth %s має контрольоване повідомлення', async (code) => {
  client.auth.signInWithPassword.mockResolvedValue({ error: { code } })
  await expect(service.login({ email: 'reader@example.com', password: 'secret123' })).rejects.toMatchObject({ code })
})
test('помилка профілю не надає прав за замовчуванням', async () => {
  profile = { data: null, error: {} }
  await expect(service.getSessionUser(session)).rejects.toMatchObject({ code: 'PROFILE' })
})
test('заблокований admin не отримує доступу', async () => {
  access.data = { role: 'admin', is_blocked: true }
  await expect(service.getSessionUser(session)).rejects.toMatchObject({ code: 'BLOCKED' })
})
test('вихід очищує лише активну особу, зберігаючи старі локальні дані', async () => {
  localStorage.setItem('bookclub.users.v1', 'legacy-data')
  localStorage.setItem('bookclub.requests.v3', 'private-data')
  service.setActiveUser({ id: 'auth-user' })
  await service.logout()
  expect(service.currentUserId()).toBeNull()
  expect(localStorage.getItem('bookclub.users.v1')).toBe('legacy-data')
  expect(localStorage.getItem('bookclub.requests.v3')).toBe('private-data')
})
test('відмова виходу повідомляється виклику', async () => {
  client.auth.signOut.mockResolvedValue({ error: { code: 'network' } })
  await expect(service.logout()).rejects.toMatchObject({ code: 'network' })
})
test('порожні дані не надсилаються до Auth', async () => {
  await expect(service.register({ name: '', email: '', password: '' })).rejects.toMatchObject({ code: 'VALIDATION' })
  expect(client.auth.signUp).not.toHaveBeenCalled()
})
