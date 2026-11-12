import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import useAuth from '../hooks/useAuth.js'
import AdminLayout from '../components/layout/AdminLayout.jsx'
import AdminDashboardPage from './AdminDashboardPage.jsx'
import AdminClubDetailsPage from './AdminClubDetailsPage.jsx'
import AdminClubsPage from './AdminClubsPage.jsx'
import { adminService } from '../services/adminService.js'
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../services/adminService.js', () => ({ adminService: { stats: vi.fn(), clubs: vi.fn(), club: vi.fn(), archive: vi.fn(), members: vi.fn() } }))
let club
function mount(path = '/admin') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="admin" element={<AdminLayout />}>
    <Route index element={<AdminDashboardPage />} /><Route path="clubs" element={<AdminClubsPage />} />
    <Route path="clubs/:clubId" element={<AdminClubDetailsPage />} />
  </Route></Routes></MemoryRouter>)
}
beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ user: { id: 'admin', role: 'admin', name: 'Адмін' }, refreshAccess: vi.fn() })
  club = { id: 'c', name: 'Книжковий клуб', description: 'Читаємо разом.', ownerName: 'Власник', ownerId: 'owner',
    membersCount: 4, format: 'online', genre: 'Проза', language: 'Українська', meetingsPerMonth: 2, createdAt: '2026-11-01T10:00Z' }
  adminService.club.mockImplementation(async () => club)
  adminService.members.mockResolvedValue({ items: [], hasMore: false })
  adminService.clubs.mockResolvedValue({ items: [{ id: 'c', name: 'Книжковий клуб', owner_name: 'Власник', members_count: 4, created_at: '2026-11-01' }], total: 21 })
  adminService.stats.mockResolvedValue({ users: 10, blocked_users: 2, active_clubs: 3, archived_clubs: 1, unique_members: 5, memberships: 8,
    requests: 10, requests_pending: 4, requests_approved: 3, requests_rejected: 2, requests_cancelled: 1 })
})
test('statistics has grouped details, useful list filters and accessible request proportions', async () => {
  mount()
  await screen.findByRole('region', { name: 'Основні показники' })
  expect(screen.getByRole('heading', { level: 1, name: 'Статистика платформи' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Статистика' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('link', { name: /Заблокованих користувачів/ })).toHaveAttribute('href', '/admin/users?state=blocked')
  expect(screen.getByRole('link', { name: /Активних користувачів/ })).toHaveAttribute('href', '/admin/users?state=active')
  expect(screen.getByRole('link', { name: /Активних клубів/ })).toHaveAttribute('href', '/admin/clubs?state=active')
  expect(screen.getByRole('link', { name: /Архівних клубів/ })).toHaveAttribute('href', '/admin/clubs?state=archived')
  expect(screen.getByRole('img', { name: /Очікують рішення: 4; Схвалених заявок: 3/ })).toBeInTheDocument()
  const analysis = screen.getByRole('region', { name: 'Статуси заявок' })
  expect(within(analysis).getByText('40%')).toBeInTheDocument()
  expect(adminService.stats).toHaveBeenCalledTimes(1)
})
test('zero requests display a meaningful empty state instead of a misleading chart', async () => {
  adminService.stats.mockResolvedValue({ requests: 0 })
  mount()
  await screen.findByText(/Заявок поки немає/)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getAllByText('0%')).toHaveLength(4)
  expect(screen.queryByText('NaN')).not.toBeInTheDocument()
})
test('details open directly after fresh load with owner, status and missing book fallback', async () => {
  mount('/admin/clubs/c')
  await screen.findByRole('heading', { name: 'Книжковий клуб' })
  expect(screen.getByText('Читаємо разом.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Власник' })).toHaveAttribute('href', '/admin/users/owner')
  for (const name of ['Основна інформація про клуб', 'Власник клубу', 'Опис клубу', 'Адміністративні дії'])
    expect(screen.getByRole('region', { name })).toBeInTheDocument()
  expect(within(screen.getByLabelText('Показники клубу')).getByText('4')).toBeInTheDocument()
  expect(screen.getByText('Немає поточної книги')).toBeInTheDocument()
  expect(screen.getByText('Не заплановано')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Переглянути на сайті' })).toHaveAttribute('href', '/clubs/c')
  expect(screen.getByRole('link', { name: 'Клуби' })).toHaveAttribute('aria-current', 'page')
})
test('list to details and back retains search filters and pagination in URL', async () => {
  mount('/admin/clubs?q=Проза&state=active&page=2')
  const nameLink = await screen.findByRole('link', { name: 'Книжковий клуб' })
  expect(nameLink).toHaveAttribute('href', expect.stringContaining('/admin/clubs/c?'))
  expect(screen.queryByRole('link', { name: /^Переглянути/ })).not.toBeInTheDocument()
  await userEvent.click(nameLink)
  await screen.findByRole('heading', { name: 'Книжковий клуб' })
  expect(screen.getByRole('link', { name: /До списку клубів/ })).toHaveAttribute('href', expect.stringContaining('state=active&page=2'))
  await userEvent.click(screen.getByRole('link', { name: /До списку клубів/ }))
  await screen.findByRole('table', { name: 'Клуби платформи' })
  expect(screen.getByRole('searchbox')).toHaveValue('Проза')
  expect(adminService.clubs).toHaveBeenLastCalledWith({ search: 'Проза', state: 'active', role: 'all', page: 2 }, expect.anything())
})
test('archive confirms existing operation, reloads details and removes archive action', async () => {
  adminService.archive.mockImplementation(async () => { club = { ...club, archivedAt: '2026-11-11T12:00Z' } })
  mount('/admin/clubs/c')
  await userEvent.click(await screen.findByRole('button', { name: 'Архівувати клуб' }))
  expect(adminService.archive).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
  expect(adminService.archive).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Архівувати клуб' }))
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  await screen.findByText('Архівний')
  expect(adminService.archive).toHaveBeenCalledWith('c')
  expect(screen.queryByRole('button', { name: 'Архівувати клуб' })).not.toBeInTheDocument()
})
test('details handle failed read, retry and missing club without unsafe actions', async () => {
  adminService.club.mockRejectedValueOnce(new Error('network')).mockResolvedValue(null)
  mount('/admin/clubs/missing')
  await screen.findByRole('alert')
  await userEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  await screen.findByRole('heading', { name: 'Клуб не знайдено' })
  expect(screen.queryByRole('button', { name: 'Архівувати клуб' })).not.toBeInTheDocument()
  await waitFor(() => expect(adminService.club).toHaveBeenCalledWith('missing', expect.anything()))
})
test('empty descriptions do not create an empty card; archived club keeps owner and site links', async () => {
  club = { ...club, description: '', archivedAt: '2026-11-11T12:00Z' }
  mount('/admin/clubs/c')
  await screen.findByRole('heading', { name: 'Книжковий клуб' })
  expect(screen.queryByRole('region', { name: 'Опис клубу' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Адміністративні дії' })).toHaveTextContent('Клуб архівовано')
  expect(screen.queryByRole('button', { name: 'Архівувати клуб' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Власник' })).toHaveAttribute('href', '/admin/users/owner')
})
