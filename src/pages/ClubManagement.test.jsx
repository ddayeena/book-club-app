import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import ClubRequestsPage from './ClubRequestsPage.jsx'
import ClubMembersPage from './ClubMembersPage.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import { requestService } from '../services/requestService.js'
import { clubService } from '../services/clubService.js'
import { ServiceError } from '../services/ServiceError.js'
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useClubs.js', () => ({ default: vi.fn() }))
vi.mock('../services/requestService.js', () => ({ requestService: { getIncoming: vi.fn(), review: vi.fn() } }))
vi.mock('../services/clubService.js', () => ({ clubService: { getMembers: vi.fn(), removeMember: vi.fn() } }))
const club = { id: 'club-a', ownerId: 'owner', name: 'Клуб', isMember: true }
const request = { id: 'r', clubId: club.id, ownerId: 'reader', status: 'pending', motivation: 'Хочу обговорювати книги', weeklyHours: 2 }
const reload = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  useAuth.mockReturnValue({ user: { id: 'owner', role: 'user' } })
  useClubs.mockReturnValue({ clubs: [club], reload })
  requestService.getIncoming.mockResolvedValue([request])
  requestService.review.mockResolvedValue({ ...request, status: 'approved' })
  clubService.getMembers.mockResolvedValue([{ user_id: 'owner', name: 'Власник' }, { user_id: 'reader', name: 'Читач' }])
  clubService.removeMember.mockResolvedValue(undefined)
})
afterEach(() => vi.restoreAllMocks())
function mount(section) {
  render(<MemoryRouter initialEntries={['/clubs/club-a/' + section]}><Routes>
    <Route path="/clubs/:clubId/requests" element={<ClubRequestsPage />} />
    <Route path="/clubs/:clubId/members" element={<ClubMembersPage />} />
    <Route path="/clubs/:clubId" element={<h1>Сторінка клубу</h1>} />
  </Routes></MemoryRouter>)
}
test('власник бачить вхідні заявки та може схвалити', async () => {
  mount('requests')
  await userEvent.click(await screen.findByRole('button', { name: 'Схвалити' }))
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  expect(await screen.findByText('Схвалено')).toBeInTheDocument()
  expect(requestService.review).toHaveBeenCalledWith('r', 'approved', '')
})
test('помилка рішення зберігає очікувану заявку', async () => {
  requestService.review.mockRejectedValue(new ServiceError('Немає доступу'))
  mount('requests')
  await userEvent.click(await screen.findByRole('button', { name: 'Відхилити' }))
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Немає доступу')
  expect(screen.getByText('Очікує рішення')).toBeInTheDocument()
})
test('стороння особа не відкриває інтерфейс вхідних заявок', async () => {
  useAuth.mockReturnValue({ user: { id: 'stranger', role: 'user' } })
  mount('requests')
  expect(await screen.findByText('Немає доступу до заявок клубу')).toBeInTheDocument()
  expect(requestService.getIncoming).not.toHaveBeenCalled()
})
test('власник може виключити іншого учасника, але не себе', async () => {
  mount('members')
  await userEvent.click(await screen.findByRole('button', { name: 'Виключити' }))
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  expect(clubService.removeMember).toHaveBeenCalledWith('club-a', 'reader')
  expect(screen.queryByRole('button', { name: 'Покинути клуб' })).not.toBeInTheDocument()
})
test('учасник виходить із клубу й повертається до його сторінки', async () => {
  useAuth.mockReturnValue({ user: { id: 'reader', role: 'user' } })
  mount('members')
  await userEvent.click(await screen.findByRole('button', { name: 'Покинути клуб' }))
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
  expect(await screen.findByText('Сторінка клубу')).toBeInTheDocument()
  expect(clubService.removeMember).toHaveBeenCalledWith('club-a', 'reader')
})
