import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import App from '../App.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import { bookService } from '../services/bookService.js'
import { meetingService } from '../services/meetingService.js'
vi.mock('../providers/AuthProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../providers/ClubsProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../providers/RequestsProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useClubs.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useRequests.js', () => ({ default: () => ({ requests: [], status: 'success' }) }))
vi.mock('../hooks/useClubSelection.js', () => ({ default: () => ({ selectedId: null, selectClub: vi.fn() }) }))
vi.mock('../services/notificationService.js', () => ({ notificationService: { count: async () => 0 } }))
vi.mock('../services/bookService.js', () => ({ bookService: { getAll: vi.fn() } }))
vi.mock('../services/meetingService.js', () => ({ meetingService: { list: vi.fn(), get: vi.fn(), save: vi.fn() } }))
const club = { id: 'c', name: 'Клуб контексту', ownerId: 'me', isMember: true, genre: 'Фентезі', language: 'Українська та англійська', format: 'online', currentBook: 'Роман', membersCount: 6, meetingsPerMonth: 2, description: 'Читаємо разом.', nextMeetingAt: '2099-01-02T12:00:00Z' }
const filters = new URLSearchParams({ q: 'контексту', genre: 'Фентезі', format: 'online', reading: '1', mine: '1', sort: 'members-desc', language: 'UA+EN', members: '6-10', meeting: '1' })
const catalog = `/clubs?${filters}`
const suffix = `?${new URLSearchParams({ returnTo: catalog })}`
function Probe() { const location = useLocation(), navigate = useNavigate(); return <><output data-testid="navigation">{location.pathname}{location.search}</output><button onClick={() => navigate(-1)}>Browser back</button><button onClick={() => navigate(1)}>Browser forward</button></> }
function mount(url) { return render(<MemoryRouter initialEntries={[url]}><App /><Probe /></MemoryRouter>) }
function breadcrumb() { return within(screen.getByRole('main')).findByRole('link', { name: 'Клуби' }) }
beforeEach(() => {
  useAuth.mockReturnValue({ user: { id: 'me', name: 'Читач', role: 'user' }, status: 'ready', refreshAccess: vi.fn() })
  useClubs.mockReturnValue({ clubs: [club, { ...club, id: 'other', name: 'Інший клуб', language: 'Англійська' }], status: 'success', reload: vi.fn().mockResolvedValue(undefined) })
  bookService.getAll.mockResolvedValue([])
  meetingService.list.mockResolvedValue({ items: [{ id: 'm', clubId: 'c', title: 'Зустріч контексту', startsAt: club.nextMeetingAt, status: 'upcoming', timezone: 'UTC', format: 'online' }], total: 21 })
  meetingService.get.mockResolvedValue({ id: 'm', clubId: 'c', title: 'Зустріч контексту', startsAt: club.nextMeetingAt, status: 'upcoming', timezone: 'UTC', format: 'online', serverNow: '2026-11-13T12:00:00Z', canManage: false })
})
test('filtered catalog → club → catalog restores all fields and actual results', async () => {
  mount(catalog)
  await userEvent.click(await screen.findByRole('link', { name: club.name }))
  const back = await breadcrumb()
  expect(back).toHaveAttribute('href', catalog)
  await userEvent.click(back)
  expect(screen.getByTestId('navigation')).toHaveTextContent(catalog)
  expect(screen.getByLabelText('Пошук клубу')).toHaveValue('контексту')
  expect(screen.getByLabelText('Жанр')).toHaveValue('Фентезі')
  expect(screen.getByLabelText('Мова клубу')).toHaveValue('UA+EN')
  expect(screen.getByLabelText('Кількість учасників')).toHaveValue('6-10')
  expect(screen.getByLabelText('Є запланована зустріч')).toBeChecked()
  expect(screen.getByLabelText('Створені мною')).toBeChecked()
  expect(screen.getByLabelText('Лише ті, що зараз читають книгу')).toBeChecked()
  expect(screen.getByLabelText('Упорядкування')).toHaveValue('members-desc')
  expect(screen.getByRole('button', { name: 'Онлайн' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('link', { name: 'Інший клуб' })).not.toBeInTheDocument()
})
test('F5/direct club URL with context retains return link, direct URL without context stays plain', async () => {
  const view = mount('/clubs/c' + suffix)
  expect(await breadcrumb()).toHaveAttribute('href', catalog)
  view.unmount(); mount('/clubs/c')
  expect(await breadcrumb()).toHaveAttribute('href', '/clubs')
  expect(screen.getByRole('link', { name: 'Книги' })).toHaveAttribute('href', '/clubs/c/books')
})
test('my clubs links do not acquire catalog filter context', async () => {
  mount('/my-clubs')
  await userEvent.click(await screen.findByRole('link', { name: club.name }))
  expect(await breadcrumb()).toHaveAttribute('href', '/clubs')
  expect(screen.getByTestId('navigation')).not.toHaveTextContent('returnTo')
})
test('browser history back and forward naturally restores catalog and club', async () => {
  mount(catalog); await userEvent.click(await screen.findByRole('link', { name: club.name }))
  await screen.findByRole('heading', { name: club.name })
  await userEvent.click(screen.getByRole('button', { name: 'Browser back' }))
  expect(await screen.findByLabelText('Мова клубу')).toHaveValue('UA+EN')
  await userEvent.click(screen.getByRole('button', { name: 'Browser forward' }))
  expect(await breadcrumb()).toHaveAttribute('href', catalog)
})
test('books breadcrumb preserves catalog context across nested route and its own filters', async () => {
  mount('/clubs/c' + suffix)
  await userEvent.click(await screen.findByRole('link', { name: 'Книги' }))
  await screen.findByRole('heading', { name: /Книжкова полиця:/ })
  await userEvent.click(screen.getByRole('button', { name: 'Прочитано' }))
  await userEvent.click(screen.getByRole('link', { name: club.name }))
  expect(await breadcrumb()).toHaveAttribute('href', catalog)
})
test('meetings pagination, status and details keep a single flat return URL', async () => {
  mount('/clubs/c/meetings' + suffix)
  await userEvent.click(await screen.findByRole('button', { name: 'Минулі' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Наступна' }))
  await waitFor(() => expect(meetingService.list).toHaveBeenLastCalledWith('c', expect.objectContaining({ page: 2, status: 'past' })))
  await userEvent.click(await screen.findByRole('link', { name: 'Зустріч контексту' }))
  const back = await screen.findByRole('link', { name: 'Зустрічі клубу' })
  expect(new URL(back.href).searchParams.get('returnTo')).toBe(catalog)
  await userEvent.click(back)
  const clubLink = screen.getByRole('link', { name: club.name })
  await userEvent.click(clubLink)
  expect(await breadcrumb()).toHaveAttribute('href', catalog)
})
test('saving a nested editor preserves context through imperative navigation', async () => {
  const meeting = { id: 'm', clubId: 'c', title: 'Зустріч контексту', startsAt: club.nextMeetingAt, updatedAt: '2026-11-13T12:00:00.123456Z', serverNow: '2026-11-13T12:00:00Z', timezone: 'UTC', format: 'online', meetingUrl: 'https://example.test/meeting', canManage: true, status: 'upcoming' }
  meetingService.get.mockResolvedValue(meeting)
  meetingService.save.mockResolvedValue(meeting)
  mount('/clubs/c/meetings/m/edit' + suffix)
  await userEvent.click(await screen.findByRole('button', { name: 'Зберегти зустріч' }))
  await screen.findByRole('heading', { name: meeting.title })
  expect(new URL(screen.getByRole('link', { name: 'Зустрічі клубу' }).href).searchParams.get('returnTo')).toBe(catalog)
  expect(meetingService.save).toHaveBeenCalledTimes(1)
})
test.each(['https://evil.test/', '//evil.test/', '/admin', '/clubs?returnTo=%2Fadmin', '/clubs/c'])('bad return URL %s falls back to catalog', async (returnTo) => {
  mount('/clubs/c?' + new URLSearchParams({ returnTo }))
  const content = await screen.findByRole('heading', { name: club.name })
  expect(within(content.closest('article')).getByRole('link', { name: 'Клуби' })).toHaveAttribute('href', '/clubs')
})
