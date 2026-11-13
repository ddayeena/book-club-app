import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes, useNavigate, useSearchParams } from 'react-router'
import { expect, test, vi } from 'vitest'
import AppLayout from './AppLayout.jsx'
import AdminLayout from './AdminLayout.jsx'
import ConfirmDialog from '../ui/ConfirmDialog.jsx'

vi.mock('../../hooks/useAuth.js', () => ({ default: () => ({ user: { id: 'u', name: 'Reader', role: 'admin' }, refreshAccess: vi.fn() }) }))
vi.mock('../../providers/ClubsProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../providers/RequestsProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../providers/ClubSelectionProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../../providers/NotificationsProvider.jsx', () => ({ default: ({ children }) => children }))
vi.mock('../clubs/ClubsGate.jsx', () => ({ default: ({ children }) => children }))
vi.mock('./SiteHeader.jsx', () => ({ default: () => <header><nav aria-label="Основна навігація"><Link to="/clubs">Клуби</Link><Link to="/profile">Профіль</Link><Link to="/admin">Керування</Link></nav></header> }))

function Page() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  return <><h1>Вміст сторінки</h1><label>Пошук<input value={params.get('q') || ''} onChange={e => setParams({ q: e.target.value })} /></label>
    <button onClick={() => setParams({ language: 'EN' })}>Мова</button>
    <button onClick={() => navigate(-1)}>Назад</button><button onClick={() => navigate(1)}>Вперед</button>
    <button onClick={() => setConfirm(true)}>Важлива дія</button>
    {confirm && <ConfirmDialog title="Підтвердити дію?" onCancel={() => setConfirm(false)} onConfirm={() => setConfirm(false)}>Пояснення наслідків.</ConfirmDialog>}</>
}
function mount(initialEntries = ['/clubs'], initialIndex) {
  return render(<MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}><Routes>
    <Route element={<AppLayout />}><Route path="clubs" element={<Page />} /><Route path="profile" element={<Page />} /></Route>
    <Route path="admin" element={<AdminLayout />}><Route index element={<h1>Статистика</h1>} /></Route>
  </Routes></MemoryRouter>)
}

test.each(['/clubs', '/profile'])('skip link is first keyboard stop and focuses main on %s', async path => {
  mount([path])
  await userEvent.tab()
  expect(screen.getByRole('link', { name: 'Перейти до вмісту' })).toHaveFocus()
  expect(screen.getByRole('link', { name: 'Перейти до вмісту' })).toHaveAttribute('href', '#main-content')
  await userEvent.keyboard('{Enter}')
  expect(screen.getByRole('main')).toHaveFocus()
})

test('ordinary path navigation focuses main without requesting scrolling, including provider boundary', async () => {
  mount()
  const focus = vi.spyOn(HTMLElement.prototype, 'focus')
  await userEvent.click(screen.getByRole('link', { name: 'Профіль' }))
  expect(screen.getByRole('main')).toHaveFocus()
  expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  focus.mockRestore()
})

test('search and query-only filter changes retain their control focus', async () => {
  mount()
  const search = screen.getByRole('textbox', { name: 'Пошук' })
  await userEvent.type(search, 'книга')
  expect(search).toHaveFocus()
  expect(search).toHaveValue('книга')
  const filter = screen.getByRole('button', { name: 'Мова' })
  await userEvent.click(filter)
  expect(filter).toHaveFocus()
})

test('back and forward do not steal focus from history controls', async () => {
  mount(['/clubs?q=читання', '/clubs?language=EN'], 1)
  const back = screen.getByRole('button', { name: 'Назад' })
  await userEvent.click(back)
  expect(back).toHaveFocus()
  expect(screen.getByRole('textbox', { name: 'Пошук' })).toHaveValue('читання')
  const forward = screen.getByRole('button', { name: 'Вперед' })
  await userEvent.click(forward)
  expect(forward).toHaveFocus()
  expect(screen.getByRole('textbox', { name: 'Пошук' })).toHaveValue('')
})

test('path history traversal does not request focus when the content tree remounts', async () => {
  mount(['/clubs', '/profile'], 1)
  const focus = vi.spyOn(HTMLElement.prototype, 'focus')
  await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
  expect(focus).not.toHaveBeenCalledWith({ preventScroll: true })
  await userEvent.click(screen.getByRole('button', { name: 'Вперед' }))
  expect(focus).not.toHaveBeenCalledWith({ preventScroll: true })
  focus.mockRestore()
})

test('dialog focus restoration is unaffected by layout focus management', async () => {
  mount()
  const trigger = screen.getByRole('button', { name: 'Важлива дія' })
  await userEvent.click(trigger)
  expect(screen.getByRole('button', { name: 'Скасувати' })).toHaveFocus()
  fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
  expect(trigger).toHaveFocus()
})

test('administrative layout has exactly its own skip link', () => {
  mount(['/admin'])
  const links = screen.getAllByRole('link', { name: 'Перейти до вмісту' })
  expect(links).toHaveLength(1)
  expect(links[0]).toHaveAttribute('href', '#admin-content')
})
