import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import RequireAdmin from '../components/auth/RequireAdmin.jsx'
import AdminLayout from '../components/layout/AdminLayout.jsx'
import AdminUsersPage from './AdminUsersPage.jsx'
import AdminUserDetailsPage from './AdminUserDetailsPage.jsx'
import useAuth from '../hooks/useAuth.js'
import { adminService } from '../services/adminService.js'
import { ServiceError } from '../services/ServiceError.js'
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../services/adminService.js', () => ({ adminService: { users: vi.fn(), user: vi.fn(), setBlocked: vi.fn() } }))
const refreshAccess = vi.fn()
let profile
function mount(path = '/admin/users/reader') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="login" element={<p>Вхід</p>} />
    <Route element={<RequireAdmin />}><Route path="admin" element={<AdminLayout />}>
      <Route path="users" element={<AdminUsersPage />} /><Route path="users/:userId" element={<AdminUserDetailsPage />} />
      <Route path="clubs/:clubId" element={<h1>Деталі вибраного клубу</h1>} />
    </Route></Route>
  </Routes></MemoryRouter>)
}
beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ user: { id: 'admin', name: 'Admin', role: 'admin' }, status: 'ready', refreshAccess })
  profile = { id: 'reader', name: 'Читач', role: 'user', isBlocked: false, createdAt: '2026-11-11T12:00Z', membershipsCount: 2,
    ownedClubs: [{ id: 'own', name: 'Власний клуб' }], joinedClubs: [{ id: 'joined', name: 'Інший клуб', archivedAt: '2026-11-11' }] }
  adminService.user.mockImplementation(async () => profile)
  adminService.users.mockResolvedValue({ items: [{ id: 'reader', name: 'Читач', role: 'user', created_at: '2026-11-11' }], total: 21 })
})
test.each([null, { id: 'u', role: 'user' }])('guest and user cannot open user details', async (user) => {
  useAuth.mockReturnValue({ user, status: 'ready' }); mount()
  await screen.findByText(user ? 'Немає доступу' : 'Вхід')
  expect(adminService.user).not.toHaveBeenCalled()
})
test('direct URL loads profile and distinct club sections with admin detail links', async () => {
  mount(); await screen.findByRole('heading', { name: 'Читач' })
  expect(screen.getByText('Користувач (user)')).toBeInTheDocument()
  expect(screen.getByText('Дата реєстрації')).toBeInTheDocument()
  const owned = screen.getByRole('region', { name: 'Власні клуби' })
  const joined = screen.getByRole('region', { name: 'Участь в інших клубах' })
  expect(within(owned).getByText('Власник')).toBeInTheDocument()
  expect(within(joined).getByText('Учасник')).toBeInTheDocument()
  expect(within(joined).getByText('Архівний')).toBeInTheDocument()
  expect(within(joined).queryByText('Власний клуб')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Власний клуб' })).toHaveAttribute('href', '/admin/clubs/own')
  await userEvent.click(screen.getByRole('link', { name: 'Інший клуб' }))
  await screen.findByRole('heading', { name: 'Деталі вибраного клубу' })
})
test('name link and return preserve user search role state and page', async () => {
  mount('/admin/users?q=Читач&role=user&state=active&page=2')
  await userEvent.click(await screen.findByRole('link', { name: 'Читач' }))
  await screen.findByRole('heading', { name: 'Читач' })
  expect(screen.getByRole('link', { name: /До списку користувачів/ })).toHaveAttribute('href', expect.stringContaining('role=user&state=active&page=2'))
  await userEvent.click(screen.getByRole('link', { name: /До списку користувачів/ }))
  await screen.findByRole('table', { name: 'Користувачі платформи' })
  expect(screen.getByRole('searchbox')).toHaveValue('Читач')
  expect(adminService.users).toHaveBeenLastCalledWith({ search: 'Читач', role: 'user', state: 'active', page: 2 }, expect.anything())
})
test('blocking confirms once, preserves history and reloads new access state', async () => {
  let resolve
  adminService.setBlocked.mockImplementation(() => new Promise((r) => { resolve = r }))
  mount(); await userEvent.click(await screen.findByRole('button', { name: 'Заблокувати користувача' }))
  expect(adminService.setBlocked).not.toHaveBeenCalled()
  const button = within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Підтвердити' })
  fireEvent.click(button); fireEvent.click(button)
  expect(adminService.setBlocked).toHaveBeenCalledTimes(1)
  expect(adminService.setBlocked).toHaveBeenCalledWith('reader', true)
  profile = { ...profile, isBlocked: true }; resolve()
  await screen.findByText('Заблоковано')
  expect(screen.getByRole('link', { name: 'Власний клуб' })).toBeInTheDocument()
})
test('unblock uses existing RPC; own account action disabled', async () => {
  profile.isBlocked = true
  const view = mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Розблокувати користувача' }))
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  await screen.findByText('Користувача розблоковано.')
  expect(adminService.setBlocked).toHaveBeenCalledWith('reader', false)
  view.unmount(); profile = { ...profile, id: 'admin', isBlocked: false, role: 'admin' }
  mount('/admin/users/admin')
  expect(await screen.findByRole('button', { name: 'Заблокувати користувача' })).toBeDisabled()
})
test('failure, retry, missing profile and empty club lists are explicit', async () => {
  adminService.user.mockRejectedValueOnce(new Error('network'))
  const view = mount(); await screen.findByRole('alert')
  profile = { ...profile, ownedClubs: [], joinedClubs: [], membershipsCount: 0 }
  await userEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  await screen.findByRole('heading', { name: 'Читач' })
  expect(screen.getAllByText('Клубів у цьому списку поки немає.')).toHaveLength(2)
  view.unmount(); adminService.user.mockResolvedValue(null); mount('/admin/users/missing')
  await screen.findByRole('heading', { name: 'Користувача не знайдено' })
  expect(screen.queryByRole('button', { name: 'Заблокувати користувача' })).not.toBeInTheDocument()
})
test('permission denial refreshes current admin rights and hides data', async () => {
  adminService.user.mockRejectedValue(new ServiceError('Немає доступу.', { code: '42501' }))
  mount(); await screen.findByRole('alert')
  await waitFor(() => expect(refreshAccess).toHaveBeenCalled())
  expect(screen.queryByRole('region', { name: 'Власні клуби' })).not.toBeInTheDocument()
})
