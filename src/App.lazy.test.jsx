import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Outlet, useLocation, useParams } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import App from './App.jsx'

const state = vi.hoisted(() => ({ user: null, adminLoads: 0, meetingLoads: 0, personalLoads: 0 }))
vi.mock('./providers/AuthProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('./providers/ClubsProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('./providers/ClubSelectionProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('./providers/RequestsProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('./providers/NotificationsProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('./hooks/useAuth.js', () => ({ default: () => ({ user: state.user, status: 'ready' }) }))
vi.mock('./components/clubs/ClubsGate.jsx', () => ({ default: ({ children }) => children }))
vi.mock('./components/layout/SiteHeader.jsx', () => ({ default: () => <nav><Link to="/profile">Профіль</Link><Link to="/clubs/c/meetings/m?returnTo=%2Fclubs%3Flanguage%3DEN">Зустріч</Link></nav> }))
vi.mock('./pages/HomePage.jsx', () => ({ default: () => <h1>Головна</h1> }))
vi.mock('./routes/personalPages.jsx', () => {
  state.personalLoads++
  return { ProfilePage: () => <h1>Особистий профіль</h1> }
})
vi.mock('./routes/editorPages.jsx', () => ({ AuthPage: ({ mode }) => <h1>{mode === 'register' ? 'Реєстрація' : 'Вхід'}</h1> }))
vi.mock('./routes/meetingPages.jsx', () => {
  state.meetingLoads++
  return { MeetingDetailsPage: () => { const params = useParams(), location = useLocation(); return <><h1>Зустріч {params.meetingId}</h1><p>{location.search}</p></> } }
})
vi.mock('./routes/adminPages.jsx', () => {
  state.adminLoads++
  return { AdminLayout: () => <main><nav>Адміністрування</nav><Outlet /></main>, AdminDashboardPage: () => <h1>Статистика</h1>, AdminUserDetailsPage: () => { const params = useParams(); return <h1>Користувач {params.userId}</h1> } }
})
function mount(path = '/') { return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>) }
beforeEach(() => { state.user = { id: 'u', name: 'Reader', role: 'user' } })

test('public home does not import admin or other deferred groups', () => {
  mount()
  expect(screen.getByRole('heading', { name: 'Головна' })).toBeInTheDocument()
  expect(state.adminLoads).toBe(0)
  expect(state.meetingLoads).toBe(0)
  expect(state.personalLoads).toBe(0)
})

test('ordinary user cannot trigger the admin bundle', () => {
  mount('/admin')
  expect(screen.getByRole('heading', { name: 'Немає доступу' })).toBeInTheDocument()
  expect(state.adminLoads).toBe(0)
})

test('guest admin URL goes through login without loading admin', async () => {
  state.user = null
  mount('/admin/users/u')
  expect(await screen.findByRole('heading', { name: 'Вхід' })).toBeInTheDocument()
  expect(state.adminLoads).toBe(0)
})

test('profile loads on navigation with a visible navigation and focused main', async () => {
  mount()
  await userEvent.click(screen.getByRole('link', { name: 'Профіль' }))
  expect(await screen.findByRole('heading', { name: 'Особистий профіль' })).toBeInTheDocument()
  // Profile uses its existing independent provider boundary, so main can remount.
  expect(screen.getByRole('main')).toHaveFocus()
  expect(state.personalLoads).toBe(1)
  expect(screen.getByRole('navigation')).toBeVisible()
})

test('nested lazy route opens directly and preserves returnTo after a fresh mount', async () => {
  mount('/clubs/c/meetings/m?returnTo=%2Fclubs%3Flanguage%3DEN')
  expect(await screen.findByRole('heading', { name: 'Зустріч m' })).toBeInTheDocument()
  expect(screen.getByText('?returnTo=%2Fclubs%3Flanguage%3DEN')).toBeInTheDocument()
})

test('admin can open a nested deferred administrative URL directly', async () => {
  state.user = { id: 'a', role: 'admin' }
  mount('/admin/users/u')
  expect(await screen.findByRole('heading', { name: 'Користувач u' })).toBeInTheDocument()
  expect(state.adminLoads).toBe(1)
})
