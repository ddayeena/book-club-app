import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import ClubsProvider from '../providers/ClubsProvider.jsx'
import ClubsGate from '../components/clubs/ClubsGate.jsx'
import ClubDetailsPage from './ClubDetailsPage.jsx'
import MyClubsPage from './MyClubsPage.jsx'
import useAuth from '../hooks/useAuth.js'
import { clubService } from '../services/clubService.js'
import { ServiceError } from '../services/ServiceError.js'
vi.mock('../services/dataSource.js', () => ({ isSupabaseData: true }))
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useClubSelection.js', () => ({ default: () => ({ selectClub: vi.fn() }) }))
vi.mock('../hooks/useRequests.js', () => ({ default: () => ({ requests: [], status: 'success' }) }))
vi.mock('../services/clubService.js', () => ({ clubService: { getAll: vi.fn(), restore: vi.fn() } }))
let club
const user = { id: 'owner', role: 'user', name: 'Власник' }
function mount(path = '/clubs/c') {
  return render(<MemoryRouter initialEntries={[path]}><ClubsProvider>
    <Link to="/my-clubs">Мої клуби</Link><ClubsGate><Routes>
      <Route path="clubs/:clubId" element={<ClubDetailsPage />} />
      <Route path="my-clubs" element={<MyClubsPage />} />
    </Routes></ClubsGate>
  </ClubsProvider></MemoryRouter>)
}
beforeEach(() => {
  vi.resetAllMocks()
  club = { id: 'c', name: 'Архів читачів', ownerId: 'owner', ownerName: 'Власник', isMember: true,
    archivedAt: '2026-11-12T12:00:00Z', genre: 'Проза', format: 'online', language: 'Українська', meetingsPerMonth: 2, membersCount: 2 }
  useAuth.mockReturnValue({ user })
  clubService.getAll.mockImplementation(async () => [{ ...club }])
  clubService.restore.mockImplementation(async () => { club = { ...club, archivedAt: null } })
})
test.each([
  ['owner', 'user', true], ['admin', 'admin', true], ['reader', 'user', false], ['stranger', 'user', false], [null, null, false],
])('restore visibility for %s/%s matches owner/admin rule', async (id, role, visible) => {
  useAuth.mockReturnValue({ user: id ? { id, role, name: 'Читач' } : null })
  mount(); await screen.findByRole('heading', { name: club.name })
  expect(Boolean(screen.queryByRole('button', { name: 'Відновити клуб' }))).toBe(visible)
})
test('active club has no restore action after a direct fresh load', async () => {
  club.archivedAt = null
  mount()
  await screen.findByRole('heading', { name: club.name })
  expect(screen.queryByRole('button', { name: 'Відновити клуб' })).not.toBeInTheDocument()
})
test('confirmation can be cancelled with Escape and restores keyboard focus', async () => {
  mount()
  const restore = await screen.findByRole('button', { name: 'Відновити клуб' })
  await userEvent.click(restore)
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Клуб знову стане активним і доступним у каталозі.')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Скасувати' })).toHaveFocus())
  await userEvent.keyboard('{Escape}')
  expect(restore).toHaveFocus()
  expect(clubService.restore).not.toHaveBeenCalled()
  await userEvent.click(restore)
  await userEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
  expect(restore).toHaveFocus()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})
test('restores only after server success, rereads catalog and moves owned club out of archive', async () => {
  mount('/my-clubs')
  const archive = await screen.findByRole('region', { name: 'Архівні клуби' })
  await userEvent.click(await within(archive).findByRole('link', { name: club.name }))
  await userEvent.click(screen.getByRole('button', { name: 'Відновити клуб' }))
  let done
  clubService.restore.mockImplementation(() => new Promise((resolve) => { done = () => { club = { ...club, archivedAt: null }; resolve() } }))
  const confirm = screen.getByRole('button', { name: 'Підтвердити' })
  fireEvent.click(confirm); fireEvent.click(confirm)
  expect(clubService.restore).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Відновити клуб' })).toBeDisabled()
  expect(screen.getByText('Клуб архівовано.')).toBeInTheDocument()
  expect(clubService.getAll).toHaveBeenCalledTimes(1)
  await act(async () => done())
  await screen.findByText('Клуб відновлено.')
  await waitFor(() => expect(screen.getByRole('status')).toHaveFocus())
  expect(clubService.getAll).toHaveBeenCalledTimes(2)
  expect(screen.queryByText('Клуб архівовано.')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Відновити клуб' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: 'Мої клуби' }))
  expect(within(screen.getByRole('region', { name: 'Створені мною' })).getByRole('link', { name: club.name })).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Архівні клуби' })).queryByRole('link', { name: club.name })).not.toBeInTheDocument()
})
test('failed restore retains archived club and allows retry; F5 rereads real status', async () => {
  clubService.restore.mockRejectedValueOnce(new ServiceError('Немає прав', { code: '42501' }))
  const view = mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Відновити клуб' }))
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('alert')).toHaveTextContent('Немає прав')
  expect(screen.getByText('Клуб архівовано.')).toBeInTheDocument()
  expect(clubService.getAll).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  await screen.findByText('Клуб відновлено.')
  view.unmount()
  mount()
  await screen.findByRole('heading', { name: club.name })
  expect(screen.queryByRole('button', { name: 'Відновити клуб' })).not.toBeInTheDocument()
  expect(clubService.getAll).toHaveBeenCalledTimes(3)
})
test('restoring as admin moves a real membership to the member category without claiming ownership', async () => {
  useAuth.mockReturnValue({ user: { id: 'reader', role: 'admin', name: 'Адмін' } })
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Відновити клуб' }))
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  await screen.findByText('Клуб відновлено.')
  await userEvent.click(screen.getByRole('link', { name: 'Мої клуби' }))
  expect(within(screen.getByRole('region', { name: 'Участь в інших клубах' })).getByRole('link', { name: club.name })).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Створені мною' })).queryByRole('link', { name: club.name })).not.toBeInTheDocument()
})

test('successful restore with failed catalog refresh explains saved state and retries only reading', async () => {
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Відновити клуб' }))
  clubService.getAll.mockRejectedValueOnce(new Error('network'))
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Клуб відновлено, але не вдалося оновити дані. Повторіть завантаження.')
  expect(clubService.restore).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  await screen.findByRole('heading', { name: club.name })
  expect(screen.queryByRole('button', { name: 'Відновити клуб' })).not.toBeInTheDocument()
  expect(clubService.restore).toHaveBeenCalledTimes(1)
})
