import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import App from '../../App.jsx'
vi.mock('../../providers/AuthProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../hooks/useAuth.js', () => ({ default: () => ({ user: { id: 'admin', role: 'admin', name: 'Admin' }, status: 'ready', refreshAccess: async () => {} }) }))
vi.mock('../../providers/ClubsProvider.jsx', () => ({ default: () => { throw new Error('Catalog unavailable') } }))
vi.mock('../../providers/RequestsProvider.jsx', () => ({ default: () => { throw new Error('Requests unavailable') } }))
vi.mock('../../services/adminService.js', () => ({ adminService: {
  stats: async () => ({ users: 1 }), users: async () => ({ total: 0, items: [] }), clubs: async () => ({ total: 0, items: [] }),
  club: async () => ({ id: 'c', name: 'Деталі тестового клубу', membersCount: 1 }),
  members: async () => ({ items: [], hasMore: false }),
  user: async () => ({ id: 'u', name: 'Деталі тестового користувача', role: 'user', ownedClubs: [], joinedClubs: [], membershipsCount: 0 }),
} }))
test.each([['/admin', 'Статистика платформи'], ['/admin/users', 'Керування користувачами'], ['/admin/clubs', 'Керування клубами'], ['/admin/clubs/c', 'Деталі тестового клубу'], ['/admin/users/u', 'Деталі тестового користувача']])(
  'real route %s renders after fresh mount without site providers or 404', async (path, title) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.queryByText(/404:/)).not.toBeInTheDocument()
    expect(screen.queryByRole('banner', { name: 'ReadHub' })).not.toBeInTheDocument()
    expect(document.querySelector('.masthead')).toBeNull()
    expect(document.querySelector('.site-footer')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Каталог' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Повернутися на сайт/ })).toBeInTheDocument()
  },
)
