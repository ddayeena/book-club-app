import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import HomePage from './HomePage.jsx'
import ClubsListPage from './ClubsListPage.jsx'
import ClubsGate from '../components/clubs/ClubsGate.jsx'
import useClubs from '../hooks/useClubs.js'
import useAuth from '../hooks/useAuth.js'
vi.mock('../hooks/useClubs.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useRequests.js', () => ({ default: () => ({ requests: [], status: 'success' }) }))
vi.mock('../hooks/useClubSelection.js', () => ({ default: () => ({ selectedId: null, selectClub: vi.fn() }) }))
const base = { id: 'a', name: 'Перший клуб', genre: 'Проза', language: 'Українська', format: 'online', membersCount: 2, meetingsPerMonth: 1, ownerId: 'me', description: 'Клуб читачів', currentBook: null }
function Probe() { const location = useLocation(); return <output data-testid="url">{location.search}</output> }
function mount(url = '/clubs') { return render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/" element={<ClubsGate><HomePage /></ClubsGate>} /><Route path="/clubs" element={<ClubsGate><ClubsListPage /></ClubsGate>} /></Routes><Probe /></MemoryRouter>) }
beforeEach(() => {
  useAuth.mockReturnValue({ user: { id: 'me', name: 'Читач', role: 'user' } })
  useClubs.mockReturnValue({ clubs: [base], status: 'success', reload: vi.fn() })
})
function timeline() { return screen.getByRole('heading', { name: 'Найближчі зустрічі' }).closest('section') }
test('home orders same-day meetings by exact instants and breaks ties by ID', () => {
  useClubs.mockReturnValue({ clubs: [
    { ...base, id: 'z', name: 'Пізня', nextMeeting: '2099-06-10', nextMeetingAt: '2099-06-10T18:00:00Z' },
    { ...base, id: 'b', name: 'Рання Б', nextMeeting: '2099-06-10', nextMeetingAt: '2099-06-10T10:00:00+02:00' },
    { ...base, id: 'a', name: 'Рання А', nextMeeting: '2099-06-10', nextMeetingAt: '2099-06-10T08:00:00Z' },
  ], status: 'success' })
  mount('/')
  expect(within(timeline()).getAllByRole('link').map((link) => link.textContent)).toEqual(['Рання А', 'Рання Б', 'Пізня'])
  const times = timeline().querySelectorAll('time')
  expect(times[0]).toHaveAttribute('datetime', '2099-06-10T08:00:00Z')
  expect(times[2].textContent).not.toBe(times[0].textContent)
})
test('home uses browser timezone consistently for calendar day and full date/time', () => {
  const instant = '2099-06-11T00:30:00+14:00'
  useClubs.mockReturnValue({ clubs: [{ ...base, nextMeeting: '2099-06-11', nextMeetingAt: instant }], status: 'success' })
  mount('/')
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  expect(within(timeline()).getByText(`Часовий пояс: ${zone}`)).toBeInTheDocument()
  expect(timeline().querySelector('time').textContent).toBe(new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short', timeZone: zone }).format(new Date(instant)))
  expect(timeline().querySelector('.timeline-date strong').textContent).toBe(String(new Date(instant).getDate()))
})
test('home does not invent time for legacy or invalid dates', () => {
  useClubs.mockReturnValue({ clubs: [{ ...base, nextMeeting: '2099-06-10' }, { ...base, id: 'bad', nextMeetingAt: 'invalid' }, { ...base, id: 'empty', nextMeetingAt: null }], status: 'success' })
  mount('/')
  expect(within(timeline()).getByText('Запланованих зустрічей із визначеним часом поки немає.')).toBeInTheDocument()
  expect(timeline().querySelector('time')).toBeNull()
  expect(timeline()).not.toHaveTextContent('Invalid Date')
})
test('mine remains an ownership filter, keeps URL and restores after F5', async () => {
  useClubs.mockReturnValue({ clubs: [base, { ...base, id: 'member', name: 'Членство', ownerId: 'other', isMember: true }], status: 'success' })
  const view = mount('/clubs?mine=1')
  expect(screen.getByRole('checkbox', { name: 'Створені мною' })).toBeChecked()
  expect(screen.getByRole('link', { name: base.name })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Членство' })).not.toBeInTheDocument()
  expect(screen.getByTestId('url')).toHaveTextContent('mine=1')
  await userEvent.click(screen.getByRole('checkbox', { name: 'Створені мною' }))
  expect(screen.getByRole('link', { name: 'Членство' })).toBeInTheDocument()
  expect(screen.getByTestId('url')).not.toHaveTextContent('mine=')
  view.unmount(); mount('/clubs?mine=1')
  expect(screen.queryByRole('link', { name: 'Членство' })).not.toBeInTheDocument()
})
test.each([{ clubs: [] }, { clubs: [{ ...base, archivedAt: '2026-11-01' }] }])('no active clubs differs from a failed filter even with query and archive: %j', ({ clubs }) => {
  useClubs.mockReturnValue({ clubs, status: 'success' })
  mount('/clubs?q=невідомий')
  expect(screen.getByText('Активних клубів поки немає.')).toBeInTheDocument()
  expect(screen.queryByText('За цими фільтрами нічого не знайдено.')).not.toBeInTheDocument()
})
test('active catalog without matching results shows the filter empty state', () => {
  mount('/clubs?q=невідомий')
  expect(screen.getByText('За цими фільтрами нічого не знайдено.')).toBeInTheDocument()
  expect(screen.queryByText('Активних клубів поки немає.')).not.toBeInTheDocument()
})
test.each(['loading', 'error'])('catalog %s does not render either successful empty state', (status) => {
  useClubs.mockReturnValue({ clubs: [], status, error: 'Помилка каталогу', reload: vi.fn() })
  mount()
  expect(screen.queryByText('Активних клубів поки немає.')).not.toBeInTheDocument()
  expect(screen.queryByText('За цими фільтрами нічого не знайдено.')).not.toBeInTheDocument()
  if (status === 'loading') expect(screen.getByText('Завантаження клубів…')).toHaveAttribute('role', 'status')
  else expect(screen.getByRole('alert')).toHaveTextContent('Помилка каталогу')
})
