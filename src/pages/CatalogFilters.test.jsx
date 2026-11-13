import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import ClubsListPage from './ClubsListPage.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useClubs.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useClubSelection.js', () => ({ default: () => ({ selectedId: null, selectClub: vi.fn() }) }))
const now = Date.parse('2030-01-01T12:00:00Z')
const base = { id: 'ua', name: 'Читачі UA', language: 'Українська', genre: 'Фентезі', membersCount: 5, format: 'online', meetingsPerMonth: 2, description: 'Читаємо разом.', currentBook: 'Роман', ownerId: 'me', nextMeetingAt: '2030-01-02T12:00:00Z' }
const clubs = [base, { ...base, id: 'en', name: 'Читачі EN', language: 'Англійська', genre: ' фентезі ', membersCount: 6 },
  { ...base, id: 'both', name: 'Читачі UA+EN', language: 'Українська та англійська', genre: ' ФЕНТЕЗІ ', membersCount: 10 }]
function Probe() { const location = useLocation(), navigate = useNavigate(); return <><output data-testid="query">{location.search}</output><button onClick={() => navigate(-1)}>Назад</button><button onClick={() => navigate(1)}>Вперед</button></> }
function mount(search = '') { return render(<MemoryRouter initialEntries={['/clubs' + search]}><ClubsListPage /><Probe /></MemoryRouter>) }
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(now)
  useAuth.mockReturnValue({ user: { id: 'me', role: 'user' } })
  useClubs.mockReturnValue({ clubs })
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
function query() { return new URLSearchParams(screen.getByTestId('query').textContent) }

test.each([['UA', 'Читачі UA'], ['EN', 'Читачі EN'], ['UA+EN', 'Читачі UA+EN']])('language %s is accessible and stored in URL', async (code, name) => {
  mount(); await userEvent.selectOptions(screen.getByLabelText('Мова клубу'), code)
  expect(screen.getByRole('link', { name })).toBeInTheDocument()
  expect(screen.getByText('Показано клубів: 1')).toBeInTheDocument()
  expect(query().get('language')).toBe(code)
  await userEvent.selectOptions(screen.getByLabelText('Мова клубу'), 'all')
  expect(query().has('language')).toBe(false)
  expect(screen.getByText('Показано клубів: 3')).toBeInTheDocument()
})
test('genre variants share one readable option and old case-sensitive URLs still restore', () => {
  mount('?genre=%20фЕнТеЗі%20')
  const select = screen.getByLabelText('Жанр')
  expect(within(select).getAllByRole('option')).toHaveLength(2)
  expect(select.selectedOptions[0].textContent).toMatch(/^Ф/)
  expect(screen.getByText('Показано клубів: 3')).toBeInTheDocument()
})
test('member size and meeting controls combine with all existing filters and survive F5', () => {
  const params = new URLSearchParams({ q: 'читачі', genre: 'фентезі', format: 'online', reading: '1', mine: '1', sort: 'members-desc', language: 'UA+EN', members: '6-10', meeting: '1', keep: 'ok' })
  const url = `?${params}`
  const view = mount(url)
  expect(screen.getByRole('link', { name: 'Читачі UA+EN' })).toBeInTheDocument()
  expect(screen.getByText('Показано клубів: 1')).toBeInTheDocument()
  expect(screen.getByLabelText('Кількість учасників')).toHaveValue('6-10')
  expect(screen.getByLabelText('Є запланована зустріч')).toBeChecked()
  expect(screen.getByLabelText('Створені мною')).toBeChecked()
  view.unmount(); mount(url)
  expect(screen.getByLabelText('Мова клубу')).toHaveValue('UA+EN')
  expect(screen.getByRole('link', { name: 'Читачі UA+EN' })).toBeInTheDocument()
})
test('back and forward restore filters and reset clears every filter without removing unrelated params', async () => {
  mount('?keep=ok')
  await userEvent.selectOptions(screen.getByLabelText('Мова клубу'), 'UA')
  await userEvent.selectOptions(screen.getByLabelText('Мова клубу'), 'EN')
  await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
  expect(screen.getByLabelText('Мова клубу')).toHaveValue('UA')
  await userEvent.click(screen.getByRole('button', { name: 'Вперед' }))
  expect(screen.getByLabelText('Мова клубу')).toHaveValue('EN')
  await userEvent.selectOptions(screen.getByLabelText('Кількість учасників'), '6-10')
  await userEvent.click(screen.getByLabelText('Є запланована зустріч'))
  await userEvent.click(screen.getByRole('button', { name: 'Скинути фільтри' }))
  expect(query().toString()).toBe('keep=ok')
  expect(screen.getByLabelText('Мова клубу')).toHaveValue('all')
  expect(screen.getByLabelText('Кількість учасників')).toHaveValue('all')
  expect(screen.getByLabelText('Є запланована зустріч')).not.toBeChecked()
})
test('reset also removes original q/genre/reading/mine/format/sort parameters', async () => {
  mount('?q=x&genre=Фентезі&format=offline&reading=1&mine=1&sort=meeting-asc&language=EN&members=over-20&meeting=1')
  await userEvent.click(screen.getByRole('button', { name: 'Скинути фільтри' }))
  expect(query().toString()).toBe('')
  expect(screen.getByText('Показано клубів: 3')).toBeInTheDocument()
})
test('invalid URL filter values fall back safely; incompatible valid filters show empty results', async () => {
  mount('?language=bad&members=-1&meeting=bad')
  expect(screen.getByLabelText('Мова клубу')).toHaveValue('all')
  expect(screen.getByLabelText('Кількість учасників')).toHaveValue('all')
  expect(screen.getByLabelText('Є запланована зустріч')).not.toBeChecked()
  await userEvent.selectOptions(screen.getByLabelText('Мова клубу'), 'UA')
  await userEvent.selectOptions(screen.getByLabelText('Кількість учасників'), 'over-20')
  expect(screen.getByText('За цими фільтрами нічого не знайдено.')).toBeInTheDocument()
})
test('active meeting filter removes a meeting when it starts without any new API request', async () => {
  vi.restoreAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now)
  useClubs.mockReturnValue({ clubs: [{ ...base, nextMeetingAt: new Date(now + 1000).toISOString() }] })
  mount('?meeting=1')
  expect(screen.getByRole('link', { name: base.name })).toBeInTheDocument()
  await act(async () => vi.advanceTimersByTime(1000))
  expect(screen.getByText('За цими фільтрами нічого не знайдено.')).toBeInTheDocument()
})
test('long meeting expiry re-arms after the browser maximum timer delay', async () => {
  vi.restoreAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now)
  const duration = 40 * 24 * 60 * 60 * 1000
  useClubs.mockReturnValue({ clubs: [{ ...base, nextMeetingAt: new Date(now + duration).toISOString() }] })
  mount('?meeting=1')
  await act(async () => vi.advanceTimersByTime(2147483647))
  expect(screen.getByRole('link', { name: base.name })).toBeInTheDocument()
  await act(async () => vi.advanceTimersByTime(duration - 2147483647))
  expect(screen.getByText('За цими фільтрами нічого не знайдено.')).toBeInTheDocument()
})
