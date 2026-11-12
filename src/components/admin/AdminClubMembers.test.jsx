import { fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import AdminClubMembers from './AdminClubMembers.jsx'
import useAuth from '../../hooks/useAuth.js'
import { adminService } from '../../services/adminService.js'
import { ServiceError } from '../../services/ServiceError.js'
vi.mock('../../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../../services/adminService.js', () => ({ adminService: { members: vi.fn() } }))
const refreshAccess = vi.fn()
const owner = { id: 'owner', name: 'Власник клубу' }
function Profile() { return <h1>Профіль: {useParams().userId}</h1> }
function mount() {
  return render(<MemoryRouter initialEntries={['/admin/clubs/c']}><Routes>
    <Route path="admin/clubs/c" element={<AdminClubMembers clubId="c" ownerId="owner" />} />
    <Route path="admin/users/:userId" element={<Profile />} />
  </Routes></MemoryRouter>)
}
beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ refreshAccess })
  adminService.members.mockResolvedValue({ items: [owner, { id: 'reader', name: 'Читач' }], hasMore: false })
})
test('renders owner and current members with roles and profile links without action buttons', async () => {
  mount()
  const section = screen.getByRole('region', { name: 'Учасники клубу' })
  await within(section).findByRole('link', { name: 'Читач' })
  expect(within(section).getByText('Власник')).toBeInTheDocument()
  expect(within(section).getByText('Учасник')).toBeInTheDocument()
  expect(within(section).getByRole('link', { name: 'Власник клубу' })).toHaveAttribute('href', '/admin/users/owner')
  expect(screen.queryByRole('button', { name: /Виключити|Заблокувати|Змінити роль/ })).not.toBeInTheDocument()
  expect(adminService.members).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByRole('link', { name: 'Читач' }))
  await screen.findByRole('heading', { name: 'Профіль: reader' })
})
test('owner-only club gives a clear message; no membership rows gives an explicit empty state', async () => {
  adminService.members.mockResolvedValue({ items: [owner], hasMore: false })
  const view = mount()
  await screen.findByText(/У клубі поки лише власник/)
  expect(screen.queryByRole('button', { name: 'Показати більше' })).not.toBeInTheDocument()
  view.unmount(); adminService.members.mockResolvedValue({ items: [], hasMore: false }); mount()
  await screen.findByText('Поточних учасників не знайдено.')
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})
test('initial loading and errors support retry without fake account statuses', async () => {
  let reject
  adminService.members.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
  mount()
  expect(screen.getByText('Завантаження учасників…')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Оновити учасників' })).toBeDisabled()
  reject(new ServiceError('Не вдалося завантажити учасників.'))
  await screen.findByRole('alert')
  await userEvent.click(screen.getByRole('button', { name: 'Повторити завантаження' }))
  await screen.findByRole('link', { name: 'Читач' })
  expect(screen.queryByText('Активний')).not.toBeInTheDocument()
  expect(screen.queryByText('Заблокований')).not.toBeInTheDocument()
})
test('show more appends one page, avoids duplicate requests and focuses newly added member', async () => {
  const first = Array.from({ length: 20 }, (_, index) => ({ id: String(index), name: 'Учасник ' + index }))
  let resolve
  adminService.members.mockResolvedValueOnce({ items: first, hasMore: true })
    .mockImplementationOnce(() => new Promise((done) => { resolve = done }))
  mount()
  const more = await screen.findByRole('button', { name: 'Показати більше' })
  fireEvent.click(more); fireEvent.click(more)
  expect(adminService.members).toHaveBeenCalledTimes(2)
  expect(adminService.members).toHaveBeenLastCalledWith('c', expect.objectContaining({ offset: 20 }))
  resolve({ items: [{ id: '20', name: 'Учасник 20' }], hasMore: false })
  const next = await screen.findByRole('link', { name: 'Учасник 20' })
  expect(screen.getAllByRole('listitem')).toHaveLength(21)
  expect(next).toHaveFocus()
  expect(screen.queryByRole('button', { name: 'Показати більше' })).not.toBeInTheDocument()
})
test('failed next page keeps loaded members and retries the same offset', async () => {
  adminService.members.mockResolvedValueOnce({ items: [owner], hasMore: true })
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValue({ items: [{ id: 'reader', name: 'Читач' }], hasMore: false })
  mount(); await userEvent.click(await screen.findByRole('button', { name: 'Показати більше' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('link', { name: 'Власник клубу' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Повторити завантаження' }))
  await screen.findByRole('link', { name: 'Читач' })
  expect(adminService.members).toHaveBeenLastCalledWith('c', expect.objectContaining({ offset: 20 }))
})
test('permission denial refreshes role; unmount aborts pending reads', async () => {
  adminService.members.mockRejectedValueOnce(new ServiceError('Немає доступу.', { code: '42501' }))
  const view = mount(); await screen.findByRole('alert')
  await waitFor(() => expect(refreshAccess).toHaveBeenCalled())
  const signal = adminService.members.mock.calls[0][1].signal
  view.unmount()
  expect(signal.aborted).toBe(true)
})
