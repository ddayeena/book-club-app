import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { setActiveUser } from './authService.js'
import { mockRequestService, storageKey } from './mockRequestService.js'
import { savedRequest, validInput } from '../test/fixtures.js'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  setActiveUser({ id: '11111111-1111-4111-8111-111111111111' })
})
afterEach(() => { setActiveUser(null); vi.useRealTimers() })
async function finish(promise) { await vi.advanceTimersByTimeAsync(700); return promise }

test('Supabase-користувач не успадковує локальний сеанс і старі заявки', async () => {
  localStorage.setItem('bookclub.session.v1', savedRequest.ownerId)
  localStorage.setItem(storageKey, JSON.stringify([savedRequest]))
  expect(await finish(mockRequestService.getAll())).toEqual([])
  const created = await finish(mockRequestService.create(validInput))
  expect(created.ownerId).toBe('11111111-1111-4111-8111-111111111111')
  expect(JSON.parse(localStorage.getItem(storageKey))).toContainEqual(savedRequest)
})
test('зміна Auth-користувача під час операції не змінює сховище', async () => {
  const original = JSON.stringify([savedRequest])
  localStorage.setItem(storageKey, original)
  const assertion = expect(mockRequestService.create(validInput)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  setActiveUser({ id: '22222222-2222-4222-8222-222222222222' })
  await vi.advanceTimersByTimeAsync(700)
  await assertion
  expect(localStorage.getItem(storageKey)).toBe(original)
})
