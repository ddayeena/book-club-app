import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from '../App.jsx'
import useAuth from '../hooks/useAuth.js'
import { notificationService } from '../services/notificationService.js'
import { ServiceError } from '../services/ServiceError.js'
vi.mock('../providers/AuthProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
// Notifications must remain usable even if unrelated providers cannot mount.
vi.mock('../providers/ClubsProvider.jsx', () => ({ default: function UnavailableCatalog({ children }) { if (useAuth().user) throw new Error('Catalog unavailable'); return children } }))
vi.mock('../providers/RequestsProvider.jsx', () => ({ default: function UnavailableRequests({ children }) { if (useAuth().user) throw new Error('Requests unavailable'); return children } }))
vi.mock('../hooks/useClubs.js', () => ({ default: () => ({ clubs: [], status: 'success' }) }))
vi.mock('../services/notificationService.js', () => ({ notificationService: { count: vi.fn(), list: vi.fn(), markRead: vi.fn() } }))
let messages
const make = (id, type, target) => ({ id, type, target, body: 'Повідомлення ' + id, createdAt: '2026-11-12T12:00:00Z', readAt: null, isStale: false })
function mount() { return render(<MemoryRouter initialEntries={['/notifications']}><App /></MemoryRouter>) }
beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ user: { id: 'a', name: 'Читач', role: 'user' }, status: 'ready' })
  messages = [make('one', 'new_request', '/clubs/c/requests'), make('two', 'request_decision', '/requests/r'), { ...make('three', 'meeting_reminder', '/clubs/c/meetings/m'), isStale: true }]
  notificationService.count.mockResolvedValue(3)
  notificationService.list.mockImplementation(async ({ filter }) => ({ items: messages.filter((n) => filter !== 'unread' || !n.readAt), total: filter === 'unread' ? messages.filter((n) => !n.readAt).length : messages.length, unreadCount: messages.filter((n) => !n.readAt).length }))
  notificationService.markRead.mockImplementation(async (id) => { messages = messages.map((n) => n.id === id ? { ...n, readAt: '2026-11-12T13:00Z' } : n); return { id, unreadCount: 2 } })
})
afterEach(() => vi.useRealTimers())
test('direct route/F5 works independently and opening does not mark read', async () => {
  mount()
  expect(await screen.findByRole('heading', { name: 'Сповіщення' })).toBeInTheDocument()
  await screen.findByText('Повідомлення one')
  expect(screen.getByRole('link', { name: 'Сповіщення. Непрочитаних: 3' })).toHaveAttribute('href', '/notifications')
  expect(screen.getAllByRole('link', { name: 'Переглянути' }).map((link) => link.getAttribute('href'))).toEqual(['/clubs/c/requests', '/requests/r', '/clubs/c/meetings/m'])
  expect(screen.getByText(/Неактуальне нагадування/)).toBeInTheDocument()
  expect(notificationService.markRead).not.toHaveBeenCalled()
})
test('guest has no bell and no private queries', async () => {
  useAuth.mockReturnValue({ user: null, status: 'ready' })
  mount()
  await screen.findByRole('heading', { name: 'Вхід' })
  expect(screen.queryByRole('link', { name: /Сповіщення/ })).not.toBeInTheDocument()
  expect(notificationService.count).not.toHaveBeenCalled(); expect(notificationService.list).not.toHaveBeenCalled()
})
test('filters, pagination and empty results remain in URL-backed state', async () => {
  notificationService.list.mockResolvedValueOnce({ items: messages, total: 21, unreadCount: 3 })
  mount(); await screen.findByText('Повідомлення one')
  await userEvent.click(screen.getByRole('button', { name: 'Наступна' }))
  await waitFor(() => expect(notificationService.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, filter: 'all' })))
  messages = []
  await userEvent.click(screen.getByRole('button', { name: 'Непрочитані' }))
  await screen.findByText('Непрочитаних сповіщень немає.')
  expect(notificationService.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, filter: 'unread' }))
})
test('read action waits for success, blocks duplicate clicks and refreshes count/list with focus', async () => {
  mount(); await screen.findByText('Повідомлення one')
  let done
  notificationService.markRead.mockImplementationOnce(() => new Promise((resolve) => { done = () => {
    messages = messages.map((n) => n.id === 'one' ? { ...n, readAt: '2026-11-12T13:00Z' } : n)
    notificationService.count.mockResolvedValue(2); resolve({ id: 'one', unreadCount: 2 })
  } }))
  const mark = screen.getAllByRole('button', { name: 'Позначити прочитаним' })[0]
  fireEvent.click(mark); fireEvent.click(mark)
  expect(notificationService.markRead).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Прочитано')).not.toBeInTheDocument()
  await act(async () => done())
  await screen.findByText('Прочитано')
  expect(screen.getByRole('link', { name: 'Сповіщення. Непрочитаних: 2' })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Сповіщення' }).parentElement).toHaveFocus())
})
test('read errors preserve unread item; list errors retry and unknown badge never claims zero', async () => {
  notificationService.list.mockRejectedValueOnce(new ServiceError('Не вдалося прочитати список'))
  notificationService.count.mockRejectedValue(new Error('network'))
  mount()
  await screen.findByText('Не вдалося прочитати список')
  expect(await screen.findByRole('link', { name: 'Сповіщення. Кількість непрочитаних недоступна' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  await screen.findByText('Повідомлення one')
  notificationService.markRead.mockRejectedValueOnce(new ServiceError('Не вдалося зберегти прочитання'))
  await userEvent.click(screen.getAllByRole('button', { name: 'Позначити прочитаним' })[0])
  await screen.findByText('Не вдалося зберегти прочитання')
  expect(screen.queryByText('Прочитано')).not.toBeInTheDocument()
})
test('account changes abort old responses and reset the counter', async () => {
  let countDone, listDone
  notificationService.count.mockImplementationOnce(() => new Promise((resolve) => { countDone = resolve }))
  notificationService.list.mockImplementationOnce(() => new Promise((resolve) => { listDone = resolve }))
  const view = mount()
  await act(async () => {})
  const signal = notificationService.list.mock.calls[0][0].signal
  useAuth.mockReturnValue({ user: { id: 'b', name: 'Інший', role: 'user' }, status: 'ready' })
  notificationService.count.mockResolvedValue(0)
  messages = []
  view.rerender(<MemoryRouter initialEntries={['/notifications']}><App /></MemoryRouter>)
  await screen.findByText('Сповіщень поки немає.')
  expect(signal.aborted).toBe(true)
  await act(async () => { countDone(99); listDone({ items: [make('secret', 'new_request', '/clubs/a/requests')], total: 1, unreadCount: 99 }) })
  expect(screen.queryByText('Повідомлення secret')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Сповіщення. Непрочитаних: 0' })).toBeInTheDocument()
})
test('focus and minute polling refresh count; timers stop on unmount', async () => {
  vi.useFakeTimers()
  const view = mount()
  await act(async () => {})
  const initial = notificationService.count.mock.calls.length
  await act(async () => { fireEvent.focus(window) })
  expect(notificationService.count.mock.calls.length).toBeGreaterThan(initial)
  const afterFocus = notificationService.count.mock.calls.length
  await act(async () => vi.advanceTimersByTime(60000))
  expect(notificationService.count.mock.calls.length).toBeGreaterThan(afterFocus)
  view.unmount()
  const stopped = notificationService.count.mock.calls.length
  await act(async () => vi.advanceTimersByTime(120000))
  expect(notificationService.count).toHaveBeenCalledTimes(stopped)
})
test('unavailable targets and zero unread are explicit, not broken links', async () => {
  messages = [{ ...make('old', 'meeting_reminder', null), isStale: true, readAt: '2026-11-12T13:00Z' }]
  notificationService.count.mockResolvedValue(0)
  mount(); await screen.findByText('Повідомлення old')
  expect(screen.getByText('Пов’язані дані зараз недоступні.')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Переглянути' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Сповіщення. Непрочитаних: 0' })).toBeInTheDocument()
})

test('large counts remain accessible while badge is compact', async () => {
  notificationService.count.mockResolvedValue(123)
  mount()
  expect(await screen.findByRole('link', { name: 'Сповіщення. Непрочитаних: 123' })).toHaveTextContent('99+')
})

test('out-of-range page does not claim that all notifications are absent', async () => {
  notificationService.list.mockResolvedValueOnce({ items: messages, total: 21, unreadCount: 3 })
  mount(); await screen.findByText('Повідомлення one')
  notificationService.list.mockResolvedValueOnce({ items: [], total: 20, unreadCount: 3 })
  await userEvent.click(screen.getByRole('button', { name: 'Наступна' }))
  await screen.findByText('На цій сторінці сповіщень немає. Поверніться на попередню сторінку.')
  expect(screen.getByRole('button', { name: 'Попередня' })).toBeEnabled()
})

test('returning to a previously failed filter clears the old error after successful reading', async () => {
  notificationService.list.mockRejectedValueOnce(new ServiceError('Стара помилка'))
  mount(); await screen.findByText('Стара помилка')
  await userEvent.click(screen.getByRole('button', { name: 'Непрочитані' }))
  await screen.findByText('Повідомлення one')
  await userEvent.click(screen.getByRole('button', { name: 'Усі' }))
  await screen.findByText('Повідомлення one')
  expect(screen.queryByText('Стара помилка')).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('focus bursts reuse the in-flight counter request instead of repeatedly aborting it', async () => {
  let done
  notificationService.count.mockImplementationOnce(() => new Promise((resolve) => { done = resolve }))
  mount(); await screen.findByText('Повідомлення one')
  const signal = notificationService.count.mock.calls[0][0].signal
  await act(async () => { fireEvent.focus(window); fireEvent.focus(window); fireEvent(document, new Event('visibilitychange')) })
  expect(notificationService.count).toHaveBeenCalledTimes(1)
  expect(signal.aborted).toBe(false)
  await act(async () => done(3))
  expect(screen.getByRole('link', { name: 'Сповіщення. Непрочитаних: 3' })).toBeInTheDocument()
})
