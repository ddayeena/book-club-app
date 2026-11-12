import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import AdminLayout from './AdminLayout.jsx'
import UserMenu from './UserMenu.jsx'
import useAuth from '../../hooks/useAuth.js'
vi.mock('../../hooks/useAuth.js', () => ({ default: vi.fn() }))
let mediaChange
beforeEach(() => {
  useAuth.mockReturnValue({ user: { id: 'a', name: 'Адмін', role: 'admin' }, refreshAccess: vi.fn() })
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: (_event, callback) => { mediaChange = callback }, removeEventListener: vi.fn() })))
})
afterEach(() => vi.unstubAllGlobals())
function mount() {
  return render(<MemoryRouter initialEntries={['/admin']}><Routes><Route path="admin" element={<AdminLayout />}>
    <Route index element={<h1>Огляд</h1>} /><Route path="users" element={<h1>Користувачі</h1>} />
  </Route></Routes></MemoryRouter>)
}
test('mobile navigation opens, traps focus and closes by Escape and backdrop', async () => {
  mount()
  const toggle = screen.getByRole('button', { name: /Меню/ })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(toggle)
  const dialog = screen.getByRole('dialog', { name: 'Панель навігації' })
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(within(dialog).getByRole('button', { name: 'Закрити меню' })).toHaveFocus()
  const last = within(dialog).getByRole('link', { name: /Повернутися на сайт/ })
  last.focus(); await userEvent.tab()
  expect(within(dialog).getByRole('link', { name: /ReadHub/ })).toHaveFocus()
  await userEvent.keyboard('{Escape}')
  expect(toggle).toHaveFocus(); expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await userEvent.click(toggle)
  fireEvent.click(screen.getByRole('button', { name: 'Закрити навігацію' }))
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(document.body.style.overflow).not.toBe('hidden')
})
test('section navigation closes drawer and focuses content; desktop resize clears modal state', async () => {
  mount()
  await userEvent.click(screen.getByRole('button', { name: /Меню/ }))
  await userEvent.click(screen.getByRole('link', { name: 'Користувачі' }))
  expect(screen.getByRole('link', { name: 'Користувачі' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('button', { name: /Меню/ })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('main')).toHaveFocus()
  await userEvent.click(screen.getByRole('button', { name: /Меню/ }))
  act(() => mediaChange({ matches: false }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(document.body.style.overflow).not.toBe('hidden')
})
test('profile menu never exposes admin links, including for admins; Escape still restores focus', async () => {
  const view = render(<MemoryRouter><UserMenu /></MemoryRouter>)
  expect(screen.queryByRole('link', { name: 'Керування платформою' })).not.toBeInTheDocument()
  const trigger = screen.getByLabelText('Меню профілю')
  await userEvent.click(trigger)
  expect(screen.queryByRole('link', { name: 'Керування платформою' })).not.toBeInTheDocument()
  expect(document.querySelector('a[href^="/admin"]')).toBeNull()
  expect(screen.queryByText('Адмінпанель')).not.toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(trigger).toHaveFocus()
  expect(screen.queryByRole('link', { name: 'Керування платформою' })).not.toBeInTheDocument()
  view.unmount()
  useAuth.mockReturnValue({ user: { id: 'u', name: 'Читач', role: 'user' } })
  render(<MemoryRouter><UserMenu /></MemoryRouter>)
  await userEvent.click(screen.getByLabelText('Меню профілю'))
  expect(screen.queryByRole('link', { name: 'Керування платформою' })).not.toBeInTheDocument()
})
