import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import AuthProvider from './AuthProvider.jsx'
import AuthGate from '../components/auth/AuthGate.jsx'
import RequireAuth from '../components/auth/RequireAuth.jsx'
import AuthPage from '../pages/AuthPage.jsx'
import useAuth from '../hooks/useAuth.js'
import * as service from '../services/authService.js'
import { deferred } from '../test/deferred.js'
import { ServiceError } from '../services/ServiceError.js'
import { StrictMode } from 'react'
import RequireAdmin from '../components/auth/RequireAdmin.jsx'

vi.mock('../services/authService.js', () => ({
  getSession: vi.fn(), getSessionUser: vi.fn(), subscribe: vi.fn(), setActiveUser: vi.fn(),
  currentUserId: vi.fn(),
  login: vi.fn(), register: vi.fn(), logout: vi.fn(),
}))
let notify
let unsubscribe
const session = { user: { id: 'a' } }
beforeEach(() => {
  vi.resetAllMocks()
  unsubscribe = vi.fn()
  service.subscribe.mockImplementation((callback) => { notify = callback; return { unsubscribe } })
  service.getSession.mockResolvedValue(null)
  service.getSessionUser.mockImplementation(async (value) => value ? { id: value.user.id, name: value.user.id, role: 'user' } : null)
  service.logout.mockResolvedValue(undefined)
})
function Probe() {
  const { user } = useAuth()
  return <p>Особа: {user?.id ?? 'guest'}</p>
}

function AccessProbe() {
  const { user, refreshAccess } = useAuth()
  return <><p>Роль: {user?.role}</p><button onClick={() => void refreshAccess()}>Перечитати права</button></>
}
test('admin F5 restores DB role; preserved access refresh removes admin routes after demotion', async () => {
  service.getSession.mockResolvedValue(session)
  service.getSessionUser.mockResolvedValue({ id: 'a', name: 'Admin', role: 'admin' })
  render(<MemoryRouter initialEntries={['/admin']}><AuthProvider><AuthGate><Routes>
    <Route element={<RequireAdmin />}><Route path="admin" element={<AccessProbe />} /></Route>
  </Routes></AuthGate></AuthProvider></MemoryRouter>)
  await screen.findByText('Роль: admin')
  service.getSessionUser.mockResolvedValue({ id: 'a', name: 'Admin', role: 'user' })
  await userEvent.click(screen.getByRole('button', { name: 'Перечитати права' }))
  await screen.findByText('Немає доступу')
  expect(service.login).not.toHaveBeenCalled()
})
test('access refresh reports blocked account through the existing AuthGate', async () => {
  service.getSession.mockResolvedValue(session)
  service.getSessionUser.mockResolvedValue({ id: 'a', name: 'Admin', role: 'admin' })
  render(<AuthProvider><AuthGate><AccessProbe /></AuthGate></AuthProvider>)
  await screen.findByText('Роль: admin')
  service.getSessionUser.mockRejectedValue(new ServiceError('Обліковий запис заблоковано.', { code: 'BLOCKED' }))
  await userEvent.click(screen.getByRole('button', { name: 'Перечитати права' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Обліковий запис заблоковано.')
  expect(screen.queryByText('Роль: admin')).not.toBeInTheDocument()
})
function mount(path = '/private') {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><AuthGate><Routes>
    <Route path="login" element={<AuthPage mode="login" />} />
    <Route path="register" element={<AuthPage mode="register" />} />
    <Route element={<RequireAuth />}><Route path="private" element={<Probe />} /></Route>
  </Routes></AuthGate></AuthProvider></MemoryRouter>)
}
test('не перенаправляє на вхід до завершення відновлення', async () => {
  const pending = deferred()
  service.getSession.mockReturnValue(pending.promise)
  mount()
  expect(screen.getByText('Відновлення сеансу…')).toBeInTheDocument()
  expect(screen.queryByLabelText('Пошта')).not.toBeInTheDocument()
  await act(async () => { pending.resolve(session) })
  expect(await screen.findByText('Особа: a')).toBeInTheDocument()
})
test('після помилки доступу повторює завантаження без дозволу за замовчуванням', async () => {
  service.getSession.mockResolvedValue(session)
  service.getSessionUser.mockRejectedValueOnce(new ServiceError('Профіль недоступний'))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('Профіль недоступний')
  expect(screen.queryByText('Особа: a')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  expect(await screen.findByText('Особа: a')).toBeInTheDocument()
})
test('реєстрація без сесії показує підтвердження, не відкриваючи приватну сторінку', async () => {
  service.register.mockResolvedValue(null)
  mount('/register')
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Імʼя'), 'Читач')
  await user.type(screen.getByLabelText('Пошта'), 'reader@example.com')
  await user.type(screen.getByLabelText('Пароль'), 'secret123')
  await user.click(screen.getByRole('button', { name: 'Зареєструватися' }))
  expect(await screen.findByText(/Перевірте пошту для підтвердження/)).toBeInTheDocument()
  expect(screen.queryByText('Особа: a')).not.toBeInTheDocument()
})
test('застаріла відповідь профілю не повертає попереднього користувача', async () => {
  const pending = deferred()
  service.getSession.mockResolvedValue(session)
  service.getSessionUser.mockReturnValueOnce(pending.promise)
  const view = mount()
  await act(async () => {})
  await act(async () => { notify(null); pending.resolve({ id: 'a' }) })
  expect(await screen.findByLabelText('Пошта')).toBeInTheDocument()
  expect(screen.queryByText('Особа: a')).not.toBeInTheDocument()
  view.unmount()
  expect(unsubscribe).toHaveBeenCalled()
})

test('StrictMode не залишає зайвих підписок Auth', async () => {
  const view = render(<StrictMode><AuthProvider><AuthGate><Probe /></AuthGate></AuthProvider></StrictMode>)
  expect(await screen.findByText('Особа: guest')).toBeInTheDocument()
  expect(service.subscribe).toHaveBeenCalledTimes(1)
  view.unmount()
  expect(unsubscribe).toHaveBeenCalledTimes(1)
})

test('оновлення токена того самого користувача не демонтує відкритий вміст', async () => {
  service.getSession.mockResolvedValue(session)
  service.currentUserId.mockReturnValue('a')
  mount()
  const content = await screen.findByText('Особа: a')
  await act(async () => { notify(session); await new Promise((resolve) => setTimeout(resolve, 20)) })
  expect(screen.getByText('Особа: a')).toBe(content)
})
