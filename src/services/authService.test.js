import { beforeEach, expect, test } from 'vitest'
import {
  currentUserId,
  demoUser,
  getSessionUser,
  hashPassword,
  login,
  logout,
  register,
  sessionKey,
  usersKey,
} from './authService.js'

beforeEach(() => {
  localStorage.clear()
})

test('хеш демо-користувача відповідає паролю demo1234', async () => {
  expect(await hashPassword('demo1234', demoUser.salt)).toBe(demoUser.hash)
})

test('демо-користувач входить і отримує сеанс', async () => {
  const user = await login({ email: 'DEMO@bookclub.test', password: 'demo1234' })

  expect(user).toEqual({ id: 'user-demo', name: 'Демо Читач', email: 'demo@bookclub.test' })
  expect(currentUserId()).toBe('user-demo')
})

test.each([
  ['невірний пароль', 'demo@bookclub.test', 'wrong-pass1'],
  ['невідома пошта', 'nobody@example.com', 'demo1234'],
])('вхід відхиляється однаковою відповіддю: %s', async (_label, email, password) => {
  await expect(login({ email, password })).rejects.toMatchObject({
    code: 'INVALID_CREDENTIALS',
    message: 'Невірна пошта або пароль.',
  })
  expect(getSessionUser()).toBeNull()
})

test('реєстрація зберігає хеш, а не пароль, і відкриває сеанс', async () => {
  const user = await register({
    name: 'Оксана Мельник', email: 'Oksana@Example.com', password: 'secret123',
  })

  expect(user.email).toBe('oksana@example.com')
  expect(getSessionUser()).toEqual(user)
  const stored = localStorage.getItem(usersKey)
  expect(stored).not.toContain('secret123')
  expect(JSON.parse(stored)[0]).toMatchObject({ salt: expect.any(String), hash: expect.any(String) })
})

test('зареєстрований користувач може знову увійти', async () => {
  await register({ name: 'Оксана', email: 'oksana@example.com', password: 'secret123' })
  logout()
  expect(getSessionUser()).toBeNull()

  const user = await login({ email: 'oksana@example.com', password: 'secret123' })

  expect(user.name).toBe('Оксана')
})

test('повторна реєстрація тієї самої пошти відхиляється', async () => {
  await register({ name: 'Оксана', email: 'oksana@example.com', password: 'secret123' })

  await expect(
    register({ name: 'Інша', email: 'OKSANA@example.com', password: 'another123' }),
  ).rejects.toMatchObject({ code: 'VALIDATION', errors: { email: expect.any(String) } })
})

test('некоректна реєстрація не створює користувача', async () => {
  await expect(
    register({ name: '', email: 'x', password: '1' }),
  ).rejects.toMatchObject({ code: 'VALIDATION' })
  expect(localStorage.getItem(usersKey)).toBeNull()
})

test('сеанс із невідомим id вважається відсутнім', () => {
  localStorage.setItem(sessionKey, 'user-хтось')
  expect(getSessionUser()).toBeNull()
})

test('вихід завершує сеанс', async () => {
  await login({ email: 'demo@bookclub.test', password: 'demo1234' })
  logout()
  expect(currentUserId()).toBeNull()
})
