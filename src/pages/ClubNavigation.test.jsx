import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import ClubDetailsPage from './ClubDetailsPage.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import useRequests from '../hooks/useRequests.js'
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useClubs.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useRequests.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useClubSelection.js', () => ({ default: () => ({ selectClub: vi.fn() }) }))
vi.mock('../services/dataSource.js', () => ({ isSupabaseData: true }))
const club = { id: 'c', name: 'Клуб навігації', genre: 'Проза', ownerId: 'owner', ownerName: 'Власник', isMember: false, membersCount: 3,
  language: 'Українська', format: 'online', meetingsPerMonth: 2, currentBook: 'Наш роман', nextMeetingAt: '2099-01-02T12:00:00Z', description: 'Читаємо разом і обговорюємо.' }
function mount(search = '') { return render(<MemoryRouter initialEntries={['/clubs/c' + search]}><Routes><Route path="/clubs/:clubId" element={<ClubDetailsPage />} /></Routes></MemoryRouter>) }
beforeEach(() => {
  useAuth.mockReturnValue({ user: { id: 'owner', role: 'user' } })
  useClubs.mockReturnValue({ clubs: [club], reload: vi.fn(), isMutating: false })
  useRequests.mockReturnValue({ requests: [], status: 'success' })
})
test.each([
  ['owner', 'user', false, false, 5, true],
  ['member', 'user', true, false, 5, false],
  ['outsider', 'user', false, false, 1, false],
  ['admin', 'admin', false, false, 5, true],
  [null, null, false, false, 1, false],
  ['owner', 'user', false, true, 5, true],
  ['member', 'user', true, true, 5, false],
  ['admin', 'admin', false, true, 5, true],
  ['applicant', 'user', false, true, 2, false],
])('club life and management match %s/%s, membership=%s, archive=%s', (id, role, isMember, archived, count, manages) => {
  useAuth.mockReturnValue({ user: id ? { id, role } : null })
  useClubs.mockReturnValue({ clubs: [{ ...club, isMember, archivedAt: archived ? '2026-11-13' : null }] })
  mount()
  const life = screen.getByRole('navigation', { name: 'Життя клубу' })
  expect(within(life).getAllByRole('link')).toHaveLength(count)
  expect(within(life).getByRole('link', { name: 'Книги' })).toHaveAttribute('href', '/clubs/c/books')
  expect(Boolean(screen.queryByRole('region', { name: 'Керування клубом' }))).toBe(manages)
  if (manages) {
    const management = screen.getByRole('region', { name: 'Керування клубом' })
    expect(within(management).getByRole('link', { name: 'Вхідні заявки' })).toBeInTheDocument()
    if (archived) {
      expect(within(management).getByRole('button', { name: 'Відновити клуб' })).toBeInTheDocument()
      expect(within(management).queryByRole('link', { name: 'Редагувати клуб' })).not.toBeInTheDocument()
      expect(within(management).queryByRole('button', { name: 'Архівувати клуб' })).not.toBeInTheDocument()
    } else {
      expect(within(management).getByRole('link', { name: 'Редагувати клуб' })).toBeInTheDocument()
      expect(within(management).getByRole('button', { name: 'Архівувати клуб' })).toBeInTheDocument()
    }
  }
  if (count <= 2) {
    expect(within(life).queryByRole('link', { name: 'Зустрічі' })).not.toBeInTheDocument()
    expect(within(life).queryByRole('link', { name: 'Обговорення' })).not.toBeInTheDocument()
    expect(within(life).queryByRole('link', { name: 'Учасники' })).not.toBeInTheDocument()
  }
  if (!id) expect(screen.getByText('Для заявки потрібно увійти в обліковий запис.')).toBeInTheDocument()
})
test('information and club links are not duplicated across blocks', () => {
  mount()
  for (const name of ['Книги', 'Голосування', 'Зустрічі', 'Обговорення', 'Учасники']) expect(screen.getAllByRole('link', { name })).toHaveLength(1)
  expect(screen.getAllByRole('heading', { name: 'Найближча зустріч' })).toHaveLength(1)
  expect(document.querySelectorAll(`time[datetime="${club.nextMeetingAt}"]`)).toHaveLength(1)
  expect(screen.getAllByText(club.currentBook)).toHaveLength(1)
  expect(screen.getAllByText('Мова спілкування')).toHaveLength(1)
  expect(screen.getAllByText('Зустрічей на місяць')).toHaveLength(1)
  expect(screen.getAllByText('Учасників')).toHaveLength(1)
  expect(screen.queryByRole('region', { name: 'Як приєднатися' })).not.toBeInTheDocument()
})
test('current member keeps leave action outside management; outsider keeps join instructions', () => {
  useAuth.mockReturnValue({ user: { id: 'member', role: 'user' } })
  useClubs.mockReturnValue({ clubs: [{ ...club, isMember: true }], reload: vi.fn() })
  const view = mount()
  expect(within(screen.getByRole('region', { name: 'Ваша участь' })).getByRole('button', { name: 'Покинути клуб' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Керування клубом' })).not.toBeInTheDocument()
  view.unmount(); useClubs.mockReturnValue({ clubs: [club] }); mount()
  expect(screen.getByRole('region', { name: 'Як приєднатися' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Обрати й підготувати заявку' })).toBeEnabled()
})
test('all club life and management links preserve returnTo and are keyboard navigable', async () => {
  const catalog = '/clubs?' + new URLSearchParams({ q: 'роман', language: 'UA', members: '6-10', meeting: '1' })
  mount('?' + new URLSearchParams({ returnTo: catalog }))
  const links = within(screen.getByRole('navigation', { name: 'Життя клубу' })).getAllByRole('link')
  for (const link of links) expect(new URL(link.href).searchParams.getAll('returnTo')).toEqual([catalog])
  expect(new URL(screen.getByRole('link', { name: 'Вхідні заявки' }).href).searchParams.get('returnTo')).toBe(catalog)
  expect(new URL(screen.getByRole('link', { name: 'Редагувати клуб' }).href).searchParams.get('returnTo')).toBe(catalog)
  expect(screen.getByRole('link', { name: 'До каталогу' })).toHaveAttribute('href', catalog)
  links[0].focus()
  await userEvent.tab()
  expect(links[1]).toHaveFocus()
  await userEvent.tab()
  expect(links[2]).toHaveFocus()
})
