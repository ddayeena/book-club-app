import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import RequireAdmin from '../components/auth/RequireAdmin.jsx'
import AdminLayout from '../components/layout/AdminLayout.jsx'
import AdminUsersPage from './AdminUsersPage.jsx'
import AdminClubsPage from './AdminClubsPage.jsx'
import AdminDashboardPage from './AdminDashboardPage.jsx'
import useAuth from '../hooks/useAuth.js'
import { adminService } from '../services/adminService.js'
import { ServiceError } from '../services/ServiceError.js'
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../services/adminService.js', () => ({ adminService: { stats: vi.fn(), users: vi.fn(), clubs: vi.fn(), setBlocked: vi.fn(), archive: vi.fn() } }))
const refreshAccess = vi.fn()
const rows = [{ id: 'self', name: 'Адмін', role: 'admin', is_blocked: false, created_at: '2026-11-11' },
  { id: 'other', name: 'Читач', role: 'user', is_blocked: false, created_at: '2026-11-11' }]
function mount(path = '/admin/users') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="login" element={<p>Форма входу</p>} />
    <Route element={<RequireAdmin />}><Route path="admin" element={<AdminLayout />}>
      <Route index element={<AdminDashboardPage />} /><Route path="users" element={<AdminUsersPage />} /><Route path="clubs" element={<AdminClubsPage />} />
    </Route></Route>
  </Routes></MemoryRouter>)
}
beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ user: { id: 'self', role: 'admin' }, status: 'ready', refreshAccess })
  adminService.users.mockResolvedValue({ items: rows, total: 21 })
  adminService.clubs.mockResolvedValue({ items: [{ id: 'c', name: 'Клуб', owner_name: 'Читач', members_count: 2, created_at: '2026-11-11' }], total: 1 })
  adminService.stats.mockResolvedValue({ users: 2, blocked_users: 0, active_clubs: 1, archived_clubs: 0, memberships: 2, unique_members: 2,
    requests: 1, requests_pending: 1, requests_approved: 0, requests_rejected: 0, requests_cancelled: 0 })
})
test.each(['/admin', '/admin/users', '/admin/clubs'])('guest direct URL %s requires existing login', async (path) => {
  useAuth.mockReturnValue({ user: null, status: 'ready' }); mount(path)
  await screen.findByText('Форма входу'); expect(adminService.users).not.toHaveBeenCalled(); expect(adminService.stats).not.toHaveBeenCalled()
})
test('ordinary user is forbidden; pending session never redirects prematurely', () => {
  useAuth.mockReturnValue({ user: { id: 'u', role: 'user' }, status: 'ready' })
  const view = mount(); expect(screen.getByText('Немає доступу')).toBeInTheDocument(); view.unmount()
  useAuth.mockReturnValue({ user: null, status: 'loading' }); mount()
  expect(screen.getByText('Перевірка прав доступу…')).toBeInTheDocument()
  expect(screen.queryByText('Форма входу')).not.toBeInTheDocument()
})
test('dashboard makes one aggregate request and refreshes access on focus', async () => {
  mount('/admin'); await screen.findByText('Унікальних учасників')
  expect(adminService.stats).toHaveBeenCalledTimes(1)
  fireEvent.focus(window); expect(refreshAccess).toHaveBeenCalled()
})
test('restores search, filters and page from URL after reload and resets page on filter changes', async () => {
  mount('/admin/users?q=Читач&role=user&state=blocked&page=2')
  await screen.findByText('Читач')
  expect(adminService.users).toHaveBeenCalledWith({ search: 'Читач', role: 'user', state: 'blocked', page: 2 }, expect.anything())
  expect(screen.getByRole('searchbox')).toHaveValue('Читач')
  await userEvent.selectOptions(screen.getByLabelText('Стан'), 'active')
  await waitFor(() => expect(adminService.users).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'active', page: 1 }), expect.anything()))
  await screen.findByText('Читач')
  await userEvent.click(screen.getByRole('button', { name: 'Наступна' }))
  await waitFor(() => expect(adminService.users).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything()))
})
test('search submission, empty results and retry after network error', async () => {
  adminService.users.mockRejectedValueOnce(new Error('network')); mount()
  await screen.findByRole('alert')
  await userEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  await screen.findByText('Читач')
  adminService.users.mockResolvedValue({ items: [], total: 0 })
  await userEvent.type(screen.getByRole('searchbox'), 'Невідомий')
  await userEvent.click(screen.getByRole('button', { name: 'Знайти' }))
  await screen.findByText(/нічого не знайдено/)
  expect(adminService.users).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Невідомий', page: 1 }), expect.anything())
})
test('self blocking is disabled; confirmation and double click protection preserve identity', async () => {
  let resolve
  adminService.setBlocked.mockImplementation(() => new Promise((r) => { resolve = r }))
  mount(); await screen.findByText('Читач')
  const buttons = screen.getAllByRole('button', { name: 'Заблокувати' })
  expect(buttons[0]).toBeDisabled()
  await userEvent.click(buttons[1]); expect(adminService.setBlocked).not.toHaveBeenCalled()
  const confirm = within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Підтвердити' })
  fireEvent.click(confirm); fireEvent.click(confirm)
  expect(adminService.setBlocked).toHaveBeenCalledTimes(1)
  expect(adminService.setBlocked).toHaveBeenCalledWith('other', true)
  resolve(); await screen.findByText('Користувача заблоковано.')
})
test('unblocking uses false; cancelled confirmation does not write', async () => {
  adminService.users.mockResolvedValue({ items: [{ ...rows[1], is_blocked: true }], total: 1 })
  mount(); await userEvent.click(await screen.findByRole('button', { name: 'Розблокувати' }))
  await userEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
  expect(adminService.setBlocked).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Розблокувати' }))
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  await screen.findByText('Користувача розблоковано.')
  expect(adminService.setBlocked).toHaveBeenCalledWith('other', false)
})
test('server denial refreshes access', async () => {
  adminService.setBlocked.mockRejectedValue(new ServiceError('Немає прав.', { code: '42501' }))
  mount(); await screen.findByText('Читач')
  await userEvent.click(screen.getAllByRole('button', { name: 'Заблокувати' })[1])
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  await screen.findByRole('alert'); expect(refreshAccess).toHaveBeenCalled()
})
test('last-admin safeguard error is shown without reporting success', async () => {
  adminService.setBlocked.mockRejectedValue(new ServiceError('Останнього активного адміністратора не можна заблокувати.', { code: '55000' }))
  mount(); await screen.findByText('Читач')
  await userEvent.click(screen.getAllByRole('button', { name: 'Заблокувати' })[1])
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Останнього активного адміністратора')
  expect(screen.queryByText('Користувача заблоковано.')).not.toBeInTheDocument()
})
test('club archive requires confirmation and calls existing archive service', async () => {
  mount('/admin/clubs')
  await userEvent.click(await screen.findByRole('button', { name: 'Архівувати' }))
  expect(screen.getByRole('alertdialog')).toHaveTextContent('незавершене голосування — скасовано')
  expect(adminService.archive).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  await screen.findByText('Клуб архівовано.'); expect(adminService.archive).toHaveBeenCalledWith('c')
})
