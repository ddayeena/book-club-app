import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import ClubDetailsPage from './ClubDetailsPage.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import useRequests from '../hooks/useRequests.js'
import { clubService } from '../services/clubService.js'
import { ownClub, savedRequest } from '../test/fixtures.js'
import { ServiceError } from '../services/ServiceError.js'

vi.mock('../services/dataSource.js', () => ({ isSupabaseData: true }))
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useClubs.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useRequests.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useClubSelection.js', () => ({ default: () => ({ selectClub: vi.fn() }) }))
vi.mock('../services/clubService.js', () => ({ clubService: { removeMember: vi.fn() } }))
let club
let history
const reload = vi.fn()
function tree() {
  return <MemoryRouter initialEntries={['/clubs/' + ownClub.id]}><Routes>
    <Route path="/clubs/:clubId" element={<ClubDetailsPage />} />
  </Routes></MemoryRouter>
}
beforeEach(() => {
  vi.clearAllMocks()
  club = { ...ownClub, ownerId: 'owner', isMember: true, membersCount: 2 }
  history = [{ ...savedRequest, clubId: club.id, ownerId: 'reader', status: 'approved' }]
  useAuth.mockReturnValue({ user: { id: 'reader', role: 'user' } })
  useClubs.mockImplementation(() => ({ clubs: [club], reload, isMutating: false }))
  useRequests.mockReturnValue({ requests: history, status: 'success' })
  clubService.removeMember.mockResolvedValue(undefined)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => vi.restoreAllMocks())

test('учасник бачить вихід безпосередньо на сторінці клубу', () => {
  render(tree())
  expect(screen.getByRole('button', { name: 'Покинути клуб' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Обрати й підготувати заявку' })).toBeDisabled()
})
test('власник не бачить вихід навіть із роллю admin', () => {
  useAuth.mockReturnValue({ user: { id: 'owner', role: 'admin' } })
  render(tree())
  expect(screen.queryByRole('button', { name: 'Покинути клуб' })).not.toBeInTheDocument()
})
test('після виходу оновлює членство, зберігає історію та дозволяє нову заявку', async () => {
  const view = render(tree())
  reload.mockImplementationOnce(async () => {
    club = { ...club, isMember: false, membersCount: 1 }
    view.rerender(tree())
  })
  await userEvent.click(screen.getByRole('button', { name: 'Покинути клуб' }))
  expect(clubService.removeMember).toHaveBeenCalledWith(club.id, 'reader')
  expect(reload).toHaveBeenCalledWith(true)
  expect(screen.queryByRole('button', { name: 'Покинути клуб' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Обрати й підготувати заявку' })).toBeEnabled()
  expect(history[0].status).toBe('approved')
})
test('відмова сервера залишає кнопку й показує помилку', async () => {
  clubService.removeMember.mockRejectedValue(new ServiceError('Вихід не виконано'))
  render(tree())
  await userEvent.click(screen.getByRole('button', { name: 'Покинути клуб' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Вихід не виконано')
  expect(screen.getByRole('button', { name: 'Покинути клуб' })).toBeEnabled()
  expect(reload).not.toHaveBeenCalled()
})
test('скасування підтвердження не викликає RPC', async () => {
  window.confirm.mockReturnValue(false)
  render(tree())
  await userEvent.click(screen.getByRole('button', { name: 'Покинути клуб' }))
  expect(clubService.removeMember).not.toHaveBeenCalled()
})
test('оновлена після схвалення ознака членства показує кнопку', () => {
  club = { ...club, isMember: false }
  const view = render(tree())
  expect(screen.queryByRole('button', { name: 'Покинути клуб' })).not.toBeInTheDocument()
  club = { ...club, isMember: true }
  view.rerender(tree())
  expect(screen.getByRole('button', { name: 'Покинути клуб' })).toBeInTheDocument()
})
