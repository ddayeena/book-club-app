import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import AppLayout from './AppLayout.jsx'
import useRequests from '../../hooks/useRequests.js'
import { requestService } from '../../services/requestService.js'
vi.mock('../../hooks/useAuth.js', () => ({ default: () => ({ user: { id: 'u', role: 'user' } }) }))
vi.mock('../../providers/ClubsProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../providers/ClubSelectionProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../providers/NotificationsProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../clubs/ClubsGate.jsx', () => ({ default: ({ children }) => children }))
vi.mock('./SiteHeader.jsx', () => ({ default: () => <nav><Link to="/clubs/c">Деталі клубу</Link><Link to="/clubs">Каталог</Link></nav> }))
vi.mock('../../services/requestService.js', () => ({ requestService: { getAll: vi.fn() } }))
function Consumer() { const { requests } = useRequests(); return <h1>{requests[0]?.status || 'Очікування'}</h1> }
beforeEach(() => { vi.clearAllMocks(); requestService.getAll.mockResolvedValue([{ id: 'r', status: 'pending' }]) })
test.each(['/clubs', '/clubs/new', '/clubs/c/books', '/clubs/c/meetings', '/clubs/c/discussions', '/my-clubs'])('no request read on %s; visiting a consumer loads its correct data once', async path => {
  render(<MemoryRouter initialEntries={[path]}><Routes><Route element={<AppLayout />}>
    <Route path="clubs/c" element={<Consumer />} /><Route path="*" element={<h1>Без заявок</h1>} />
  </Route></Routes></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'Без заявок' })).toBeInTheDocument()
  expect(requestService.getAll).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('link', { name: 'Деталі клубу' }))
  expect(await screen.findByRole('heading', { name: 'pending' })).toBeInTheDocument()
  await userEvent.click(within(screen.getByRole('navigation')).getByRole('link', { name: 'Каталог' }))
  await userEvent.click(screen.getByRole('link', { name: 'Деталі клубу' }))
  expect(screen.getByRole('heading', { name: 'pending' })).toBeInTheDocument()
  expect(requestService.getAll).toHaveBeenCalledTimes(1)
})
