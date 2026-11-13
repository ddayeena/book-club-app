import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import {
  failNextMockRequest,
  mockRequestService,
  storageKey,
} from './mockRequestService.js'
import { requests as initialRequests } from '../data/requests.js'
import { validInput } from '../test/fixtures.js'
import { signInDemo, signInOther, signOut } from '../test/auth.js'

vi.mock('./authService.js', () => import('../test/legacyAuthService.js'))

beforeEach(() => {
  localStorage.clear()
  signInDemo()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

async function finish(promise) {
  await vi.advanceTimersByTimeAsync(700)
  return promise
}

test('без збережених даних повертає початковий набір', async () => {
  const records = await finish(mockRequestService.getAll())

  expect(records).toHaveLength(initialRequests.length)
})

test('створення зберігає запис у localStorage з id і датою створення', async () => {
  const created = await finish(mockRequestService.create(validInput))

  expect(created.id).toMatch(/^req-/)
  expect(created.createdAt).toEqual(expect.any(String))
  const stored = JSON.parse(localStorage.getItem(storageKey))
  expect(stored.map((record) => record.id)).toContain(created.id)
  const again = await finish(mockRequestService.getAll())
  expect(again.find((record) => record.id === created.id)).toEqual(created)
})

test('оновлення зберігає id та дату створення', async () => {
  const created = await finish(mockRequestService.create(validInput))

  const updated = await finish(mockRequestService.update(created.id, {
    ...validInput, motivation: 'Нова мотивація для оновленої заявки.',
  }))

  expect(updated.id).toBe(created.id)
  expect(updated.createdAt).toBe(created.createdAt)
  expect(updated.motivation).toBe('Нова мотивація для оновленої заявки.')
})

test('видалення прибирає лише потрібний запис', async () => {
  const created = await finish(mockRequestService.create(validInput))

  await finish(mockRequestService.delete(created.id))

  const records = await finish(mockRequestService.getAll())
  expect(records.map((record) => record.id)).not.toContain(created.id)
  expect(records).toHaveLength(initialRequests.length)
})

test('оновлення відсутнього запису повертає NOT_FOUND', async () => {
  const assertion = expect(
    mockRequestService.update('req-missing', validInput),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' })

  await vi.advanceTimersByTimeAsync(700)
  await assertion
})

test('навчальна відмова спрацьовує один раз і не змінює дані', async () => {
  failNextMockRequest('delete')
  const first = expect(mockRequestService.delete('req-001')).rejects.toMatchObject({
    code: 'MOCK_FAILURE',
  })
  await vi.advanceTimersByTimeAsync(700)
  await first

  const records = await finish(mockRequestService.getAll())
  expect(records.map((record) => record.id)).toContain('req-001')

  await finish(mockRequestService.delete('req-001'))
  const after = await finish(mockRequestService.getAll())
  expect(after.map((record) => record.id)).not.toContain('req-001')
})

test('пошкоджені збережені дані дають зрозумілу помилку, а не аварію', async () => {
  localStorage.setItem(storageKey, '{не json')

  const assertion = expect(mockRequestService.getAll()).rejects.toMatchObject({
    code: 'STORAGE_READ',
  })
  await vi.advanceTimersByTimeAsync(700)
  await assertion
})

test('створення записує власника з поточного сеансу, а не з полів форми', async () => {
  const created = await finish(mockRequestService.create({
    ...validInput, ownerId: 'user-хтось-інший',
  }))

  expect(created.ownerId).toBe('user-demo')
})

test('користувач бачить лише свої заявки й не може змінити чужі', async () => {
  const created = await finish(mockRequestService.create(validInput))
  signInOther()

  const mine = await finish(mockRequestService.getAll())
  expect(mine).toEqual([])

  const update = expect(
    mockRequestService.update(created.id, validInput),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await vi.advanceTimersByTimeAsync(700)
  await update

  const remove = expect(mockRequestService.delete(created.id)).rejects.toMatchObject({
    code: 'NOT_FOUND',
  })
  await vi.advanceTimersByTimeAsync(700)
  await remove

  signInDemo()
  const stillThere = await finish(mockRequestService.getAll())
  expect(stillThere.map((record) => record.id)).toContain(created.id)
})

test('без входу сервіс повертає UNAUTHORIZED', async () => {
  signOut()

  const assertion = expect(mockRequestService.getAll()).rejects.toMatchObject({
    code: 'UNAUTHORIZED',
  })
  await vi.advanceTimersByTimeAsync(700)
  await assertion
})

test('зміна користувача під час збереження не записує заявку іншій особі', async () => {
  const before = localStorage.getItem(storageKey)
  const assertion = expect(mockRequestService.create(validInput)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  signInOther()
  await vi.advanceTimersByTimeAsync(700)
  await assertion
  expect(localStorage.getItem(storageKey)).toBe(before)
})

test('новий Auth UUID не отримує старі демо-заявки', async () => {
  signInOther()
  expect(await finish(mockRequestService.getAll())).toEqual([])
})
