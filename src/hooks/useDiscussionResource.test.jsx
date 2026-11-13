import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import useDiscussionResource from './useDiscussionResource.js'
import useAuth from './useAuth.js'
import { bookService } from '../services/bookService.js'
import { discussionService } from '../services/discussionService.js'
import { deferred } from '../test/deferred.js'
vi.mock('./useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../services/bookService.js', () => ({ bookService: { getAll: vi.fn() } }))
vi.mock('../services/discussionService.js', () => ({ discussionService: { list: vi.fn() } }))
beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ user: { id: 'a' } })
  bookService.getAll.mockImplementation(async club => [{ id: club, title: `Book ${club}` }])
  discussionService.list.mockImplementation(async (club, { page }) => ({ items: [{ title: `${club} page ${page}` }], total: 30 }))
})
test('pagination and filtering reuse books but display current topics; reload refreshes books', async () => {
  const { result, rerender } = renderHook(({ page, book }) => useDiscussionResource('list', 'c', null, page, book), { initialProps: { page: 1, book: null } })
  await waitFor(() => expect(result.current.data?.books[0].title).toBe('Book c'))
  rerender({ page: 2, book: null })
  await waitFor(() => expect(result.current.data?.list.items[0].title).toBe('c page 2'))
  rerender({ page: 1, book: 'c' })
  await waitFor(() => expect(result.current.data?.list.items[0].title).toBe('c page 1'))
  expect(result.current.data.books[0].title).toBe('Book c')
  expect(bookService.getAll).toHaveBeenCalledTimes(1)
  bookService.getAll.mockResolvedValue([{ id: 'new', title: 'Updated shelf' }])
  act(() => result.current.reload())
  await waitFor(() => expect(result.current.data?.books[0].title).toBe('Updated shelf'))
  expect(bookService.getAll).toHaveBeenCalledTimes(2)
})
test('club and account changes discard references immediately and ignore old responses', async () => {
  const late = deferred()
  bookService.getAll.mockReturnValueOnce(late.promise)
  const { result, rerender } = renderHook(({ club }) => useDiscussionResource('list', club), { initialProps: { club: 'old' } })
  rerender({ club: 'new' })
  await waitFor(() => expect(result.current.data?.books[0].title).toBe('Book new'))
  await act(async () => late.resolve([{ title: 'Old private book' }]))
  expect(result.current.data.books[0].title).toBe('Book new')
  const next = deferred()
  bookService.getAll.mockReturnValueOnce(next.promise)
  useAuth.mockReturnValue({ user: { id: 'b' } })
  rerender({ club: 'new' })
  expect(result.current.data).toBeFalsy()
  await act(async () => next.resolve([{ title: 'Bob shelf' }]))
  await waitFor(() => expect(result.current.data?.books[0].title).toBe('Bob shelf'))
  expect(result.current.data.list.items[0].title).toBe('new page 1')
})
test('late topic page response cannot replace the current page', async () => {
  const late = deferred()
  discussionService.list.mockReturnValueOnce(late.promise)
  const { result, rerender } = renderHook(({ page }) => useDiscussionResource('list', 'c', null, page), { initialProps: { page: 1 } })
  rerender({ page: 2 })
  await waitFor(() => expect(result.current.data?.list.items[0].title).toBe('c page 2'))
  await act(async () => late.resolve({ items: [{ title: 'Stale page' }] }))
  expect(result.current.data.list.items[0].title).toBe('c page 2')
})
