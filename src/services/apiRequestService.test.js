import { afterEach, expect, test, vi } from 'vitest'
import { createApiRequestService } from './apiRequestService.js'
import { savedRequest } from '../test/fixtures.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(response) {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

test('відхиляє HTTP 404 замість удаваного успіху', async () => {
  const fetchMock = stubFetch(new Response(null, { status: 404 }))
  const service = createApiRequestService('https://example.test/api')

  await expect(service.getById('missing')).rejects.toMatchObject({
    code: 'NOT_FOUND', status: 404,
  })
  expect(fetchMock).toHaveBeenCalledWith(
    'https://example.test/api/requests/missing',
    expect.objectContaining({ method: 'GET' }),
  )
})

test('після DELETE 204 не намагається читати JSON', async () => {
  const response = new Response(null, { status: 204 })
  const readJson = vi.spyOn(response, 'json')
  const fetchMock = stubFetch(response)
  const service = createApiRequestService('https://example.test/api')

  await expect(service.delete('req-test-001')).resolves.toBeUndefined()
  expect(readJson).not.toHaveBeenCalled()
  expect(fetchMock).toHaveBeenCalledWith(
    'https://example.test/api/requests/req-test-001',
    expect.objectContaining({ method: 'DELETE' }),
  )
})

test('успішно читає список із усіма полями заявки', async () => {
  stubFetch(new Response(JSON.stringify([savedRequest]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))
  const service = createApiRequestService('https://example.test/api')

  await expect(service.getAll()).resolves.toEqual([savedRequest])
})

test.each([
  { label: 'неправильна оболонка', body: { items: [] } },
  { label: 'тип тривалості', body: [{ ...savedRequest, weeklyHours: 'two' }] },
  { label: 'відсутній досвід читання', body: [{ ...savedRequest, experience: undefined }] },
  { label: 'відсутній власник', body: [{ ...savedRequest, ownerId: undefined }] },
  { label: 'відсутня дата створення', body: [{ ...savedRequest, createdAt: undefined }] },
  { label: 'повторний id', body: [savedRequest, { ...savedRequest }] },
])('відхиляє несумісну структуру: $label', async ({ body }) => {
  stubFetch(new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))
  const service = createApiRequestService('https://example.test/api')

  await expect(service.getAll()).rejects.toMatchObject({ code: 'BAD_DATA' })
})

test('не надсилає запит створення, якщо поля некоректні', async () => {
  const fetchMock = stubFetch(new Response(null, { status: 201 }))
  const service = createApiRequestService('https://example.test/api')

  await expect(service.create({ clubId: 'club-001' })).rejects.toMatchObject({
    code: 'VALIDATION',
  })
  expect(fetchMock).not.toHaveBeenCalled()
})