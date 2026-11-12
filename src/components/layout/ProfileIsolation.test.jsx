import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import App from '../../App.jsx'
vi.mock('../../providers/AuthProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../hooks/useAuth.js', () => ({ default: () => ({ user: { id: 'u', name: 'Reader', role: 'user' }, status: 'ready' }) }))
vi.mock('../../providers/ClubsProvider.jsx', () => ({ default: () => { throw new Error('Catalog unavailable') } }))
vi.mock('../../providers/RequestsProvider.jsx', () => ({ default: () => { throw new Error('Requests unavailable') } }))
vi.mock('../../services/profileService.js', () => ({ profileService: { get: async () => ({ id: 'u', name: 'Reader', remindersEnabled: false }) } }))
test('profile opens directly without mounting catalog or request providers', async () => {
  render(<MemoryRouter initialEntries={['/profile']}><App /></MemoryRouter>)
  expect(await screen.findByLabelText('Ім’я')).toHaveValue('Reader')
  expect(screen.queryByText(/404:/)).not.toBeInTheDocument()
})
