import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import App from './App.jsx'
vi.mock('./services/dataSource.js', () => ({ isSupabaseData: true }))
vi.mock('./services/authService.js', () => ({
  getSession: async () => null, getSessionUser: async () => null,
  subscribe: () => ({ unsubscribe() {} }), setActiveUser() {}, currentUserId: () => null,
}))
vi.mock('./services/clubService.js', () => ({ clubService: {
  getAll: vi.fn().mockRejectedValue(new Error('Database unavailable')),
} }))
test.each(['/login', '/register'])('недоступна база клубів не блокує Auth-маршрут %s', async (path) => {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
  expect(await screen.findByLabelText('Пошта')).toBeInTheDocument()
  expect(screen.queryByText('Завантаження клубів…')).not.toBeInTheDocument()
})
