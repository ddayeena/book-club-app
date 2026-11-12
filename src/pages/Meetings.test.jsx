import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import App from '../App.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import { meetingService } from '../services/meetingService.js'
import { ServiceError } from '../services/ServiceError.js'
vi.mock('../providers/AuthProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../providers/ClubsProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../providers/RequestsProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useClubs.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useRequests.js', () => ({ default: () => ({ requests: [], status: 'success' }) }))
vi.mock('../services/dataSource.js', () => ({ isSupabaseData: true }))
vi.mock('../services/meetingService.js', () => ({ meetingService: { list: vi.fn(), get: vi.fn(), save: vi.fn(), cancel: vi.fn() } }))
const reload = vi.fn(), refreshAccess = vi.fn()
const club = { id: 'c', name: 'Книжковий клуб', ownerId: 'owner', isMember: true, format: 'online', language: 'Українська', description: 'Читаємо разом.', genre: 'Проза', membersCount: 2 }
const meeting = { id: 'm', clubId: 'c', title: 'Обговорення роману', startsAt: '2099-06-10T12:00:00Z', timezone: 'UTC', format: 'online',
 meetingUrl: 'https://example.test/private', description: 'Лише для учасників', updatedAt: '2026-11-12T12:00:00.123456Z', status: 'upcoming', canManage: true, serverNow: '2026-11-12T12:00:00Z' }
function mount(url = '/clubs/c/meetings') { return render(<MemoryRouter initialEntries={[url]}><App /></MemoryRouter>) }
beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ user: { id: 'owner', name: 'Читач', role: 'user' }, status: 'ready', refreshAccess })
  useClubs.mockReturnValue({ clubs: [club], status: 'success', reload, isMutating: false })
  reload.mockResolvedValue(undefined)
  meetingService.list.mockResolvedValue({ items: [meeting], total: 1 })
  meetingService.get.mockResolvedValue(meeting)
  meetingService.save.mockResolvedValue(meeting)
  meetingService.cancel.mockResolvedValue(undefined)
})
test.each(['/clubs/c/meetings', '/clubs/c/meetings/new', '/clubs/c/meetings/m', '/clubs/c/meetings/m/edit'])('guest direct route %s requires login', async (url) => {
  useAuth.mockReturnValue({ user: null, status: 'ready' }); mount(url)
  expect(await screen.findByRole('heading', { name: 'Вхід' })).toBeInTheDocument()
  expect(meetingService.get).not.toHaveBeenCalled(); expect(meetingService.list).not.toHaveBeenCalled()
})
test('direct list URL/F5 loads data and navigates to private details', async () => {
  mount()
  await userEvent.click(await screen.findByRole('link', { name: meeting.title }))
  expect(await screen.findByRole('heading', { name: meeting.title })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Відкрити онлайн/ })).toHaveAttribute('href', meeting.meetingUrl)
  expect(screen.getByText('Лише для учасників')).toBeInTheDocument()
})
test('category, pagination, loading, error and retry are functional', async () => {
  meetingService.list.mockResolvedValueOnce({ items: [], total: 0 })
  mount(); await screen.findByText('У цій категорії зустрічей поки немає.')
  meetingService.list.mockRejectedValueOnce(new ServiceError('Помилка розкладу'))
  await userEvent.click(screen.getByRole('button', { name: 'Минулі' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('button', { name: 'Минулі' })).toHaveFocus()
  expect(meetingService.list).toHaveBeenCalledTimes(2)
  expect(screen.getByText('Помилка розкладу')).toBeInTheDocument()
  meetingService.list.mockResolvedValueOnce({ items: [meeting], total: 21 })
  await userEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  await screen.findByRole('link', { name: meeting.title })
  await userEvent.click(screen.getByRole('button', { name: 'Наступна' }))
  await waitFor(() => expect(meetingService.list).toHaveBeenLastCalledWith('c', expect.objectContaining({ status: 'past', page: 2 })))
  await userEvent.click(screen.getByRole('button', { name: 'Скасовані' }))
  await waitFor(() => expect(meetingService.list).toHaveBeenLastCalledWith('c', expect.objectContaining({ status: 'cancelled', page: 1 })))
})
test('create form validates, focuses an error and saves a browser-local time', async () => {
  mount('/clubs/c/meetings/new')
  await userEvent.click(screen.getByRole('button', { name: 'Зберегти зустріч' }))
  expect(screen.getByLabelText('Назва зустрічі')).toHaveFocus()
  expect(meetingService.save).not.toHaveBeenCalled()
  await userEvent.type(screen.getByLabelText('Назва зустрічі'), 'Обговорення роману')
  fireEvent.change(screen.getByLabelText('Дата й час'), { target: { value: '2099-06-10T12:30' } })
  await userEvent.type(screen.getByLabelText('Посилання на зустріч'), 'https://example.test/private')
  expect(screen.getByText(/Часовий пояс браузера/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Зберегти зустріч' }))
  await screen.findByRole('heading', { name: meeting.title })
  expect(meetingService.save).toHaveBeenCalledWith('c', expect.objectContaining({ localTime: '2099-06-10T12:30' }), null)
})
test('edit preserves input on failure, prevents double save and sends concurrency token', async () => {
  mount('/clubs/c/meetings/m/edit')
  const title = await screen.findByLabelText('Назва зустрічі')
  await userEvent.clear(title); await userEvent.type(title, 'Інша назва')
  let reject
  meetingService.save.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
  const save = screen.getByRole('button', { name: 'Зберегти зустріч' })
  fireEvent.click(save); fireEvent.click(save)
  expect(meetingService.save).toHaveBeenCalledTimes(1)
  expect(meetingService.save).toHaveBeenCalledWith('c', expect.objectContaining({ title: 'Інша назва' }), expect.objectContaining({ updatedAt: meeting.updatedAt }))
  await act(async () => reject(new ServiceError('Оновіть дані', { code: '40001' })))
  expect(title).toHaveValue('Інша назва')
  expect(screen.getByRole('alert')).toHaveTextContent('Оновіть дані')
})
test('cancel confirmation supports Escape, restores focus, and preserves history', async () => {
  mount('/clubs/c/meetings/m')
  const cancel = await screen.findByRole('button', { name: 'Скасувати зустріч' })
  await userEvent.click(cancel)
  const keep = screen.getByRole('button', { name: 'Скасувати' })
  await waitFor(() => expect(keep).toHaveFocus())
  await userEvent.keyboard('{Escape}')
  expect(cancel).toHaveFocus()
  expect(meetingService.cancel).not.toHaveBeenCalled()
  await userEvent.click(cancel)
  meetingService.get.mockResolvedValue({ ...meeting, canManage: false, status: 'cancelled', cancelledAt: '2026-11-12', cancelReason: 'owner' })
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  await screen.findByText('Зустріч скасовано. Запис збережено в історії.')
  expect(meetingService.cancel).toHaveBeenCalledWith(meeting)
  expect(await screen.findByText('Зустріч скасовано власником.')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Редагувати зустріч' })).not.toBeInTheDocument()
})
test.each(['reader', 'admin'])('%s can read but not manage another owner meeting', async (id) => {
  useAuth.mockReturnValue({ user: { id, name: 'Читач', role: id === 'admin' ? 'admin' : 'user' }, status: 'ready' })
  mount('/clubs/c/meetings/m')
  await screen.findByRole('heading', { name: meeting.title })
  expect(screen.queryByRole('button', { name: 'Скасувати зустріч' })).not.toBeInTheDocument()
})
test('outsider cannot load private details; direct admin edit is denied', () => {
  useAuth.mockReturnValue({ user: { id: 'stranger', name: 'Гість', role: 'user' }, status: 'ready' })
  useClubs.mockReturnValue({ clubs: [{ ...club, isMember: false }], status: 'success' })
  const view = mount('/clubs/c/meetings/m')
  expect(screen.getByRole('heading', { name: 'Зустрічі доступні лише учасникам клубу' })).toBeInTheDocument()
  expect(meetingService.get).not.toHaveBeenCalled()
  view.unmount()
  useAuth.mockReturnValue({ user: { id: 'admin', name: 'Адмін', role: 'admin' }, status: 'ready' })
  mount('/clubs/c/meetings/m/edit')
  expect(screen.queryByRole('form', { name: 'Форма зустрічі' })).not.toBeInTheDocument()
})
test.each(['past', 'cancelled'])('%s meetings remain read only after F5', async (status) => {
  meetingService.get.mockResolvedValue({ ...meeting, status, canManage: false })
  mount('/clubs/c/meetings/m/edit')
  await screen.findByText('Ця зустріч доступна лише для перегляду.')
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})
test('archive hides creation and retains list; a wrong-club detail response is discarded', async () => {
  useClubs.mockReturnValue({ clubs: [{ ...club, archivedAt: '2026-11-12' }], status: 'success', reload })
  const view = mount()
  await screen.findByRole('link', { name: meeting.title })
  expect(screen.queryByRole('link', { name: 'Створити зустріч' })).not.toBeInTheDocument()
  view.unmount()
  meetingService.get.mockResolvedValue({ ...meeting, clubId: 'other' })
  mount('/clubs/c/meetings/m')
  await screen.findByRole('alert')
  expect(screen.queryByText('Лише для учасників')).not.toBeInTheDocument()
})
test('club page shows legacy date separately without private URLs', () => {
  useClubs.mockReturnValue({ clubs: [{ ...club, nextMeeting: '2099-06-10', nextMeetingAt: meeting.startsAt, legacyNextMeeting: '2020-01-02' }], status: 'success', reload })
  mount('/clubs/c')
  expect(screen.getByText(/Дата зі старого розкладу — час не уточнено/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Усі зустрічі' })).toHaveAttribute('href', '/clubs/c/meetings')
  expect(screen.queryByRole('link', { name: /Відкрити онлайн/ })).not.toBeInTheDocument()
})

test('detail read error supports retry after direct URL loading', async () => {
  let reject
  meetingService.get.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
  mount('/clubs/c/meetings/m')
  expect(screen.getByText('Завантаження зустрічі…')).toBeInTheDocument()
  await act(async () => reject(new ServiceError('Немає зв’язку')))
  expect(screen.getByRole('alert')).toHaveTextContent('Немає зв’язку')
  await userEvent.click(screen.getByRole('button', { name: 'Оновити дані' }))
  await screen.findByRole('heading', { name: meeting.title })
})

test('changing account aborts an old detail request and cannot display its response', async () => {
  let resolve
  meetingService.get.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
  const view = mount('/clubs/c/meetings/m')
  const signal = meetingService.get.mock.calls[0][1].signal
  useAuth.mockReturnValue({ user: { id: 'stranger', name: 'Інший', role: 'user' }, status: 'ready' })
  useClubs.mockReturnValue({ clubs: [{ ...club, isMember: false }], status: 'success' })
  view.rerender(<MemoryRouter initialEntries={['/clubs/c/meetings/m']}><App /></MemoryRouter>)
  expect(signal.aborted).toBe(true)
  await act(async () => resolve(meeting))
  expect(screen.queryByText('Лише для учасників')).not.toBeInTheDocument()
})

test('editor loading errors retry without exposing a partial form', async () => {
  meetingService.get.mockRejectedValueOnce(new ServiceError('Помилка читання'))
  mount('/clubs/c/meetings/m/edit')
  await screen.findByRole('alert')
  expect(screen.queryByRole('form', { name: 'Форма зустрічі' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Перечитати актуальні дані' }))
  expect(await screen.findByLabelText('Назва зустрічі')).toHaveValue(meeting.title)
})

