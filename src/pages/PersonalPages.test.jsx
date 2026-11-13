import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import ProfilePage from './ProfilePage.jsx'
import MyClubsPage from './MyClubsPage.jsx'
import RequireAuth from '../components/auth/RequireAuth.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import { profileService } from '../services/profileService.js'
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useClubs.js', () => ({ default: vi.fn() }))
vi.mock('../services/profileService.js', () => ({ profileService: { get: vi.fn(), save: vi.fn(), signedAvatar: vi.fn() } }))
const refreshAccess = vi.fn()
const path = 'a/00000000-0000-4000-8000-000000000001.png'
let profile
function mount(url = '/profile') {
  return render(<MemoryRouter initialEntries={[url]}><Routes><Route path="login" element={<p>Вхід</p>} />
    <Route element={<RequireAuth />}><Route path="profile" element={<ProfilePage />} /><Route path="my-clubs" element={<MyClubsPage />} /></Route>
  </Routes></MemoryRouter>)
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:preview'); static revokeObjectURL = vi.fn() })
  profile = { id: 'a', name: 'Читач', avatarPath: null, remindersEnabled: false, createdAt: '2026-11-12T12:00Z' }
  useAuth.mockReturnValue({ user: { ...profile, registeredAt: '2026-11-10T12:00Z' }, refreshAccess })
  profileService.get.mockImplementation(async () => profile)
  profileService.save.mockImplementation(async (draft) => ({ profile: { ...profile, ...draft }, warning: '' }))
  profileService.signedAvatar.mockResolvedValue('https://example.test/avatar')
  useClubs.mockReturnValue({ clubs: [], status: 'success', reload: vi.fn() })
})
afterEach(() => vi.unstubAllGlobals())
test.each(['/profile', '/my-clubs'])('guest direct URL %s requires login', async (url) => {
  useAuth.mockReturnValue({ user: null }); mount(url); await screen.findByText('Вхід')
  expect(profileService.get).not.toHaveBeenCalled()
})
test('profile loads after F5 and validates/saves name and reminders then synchronizes Auth', async () => {
  mount(); await screen.findByLabelText('Ім’я')
  expect(screen.getByText(/Нагадування про зустрічі надходять у центр сповіщень ReadHub/)).toHaveTextContent('Ви можете вмикати й вимикати їх тут, у профілі. Це внутрішні сповіщення, а не email чи push.')
  expect(screen.queryByText(/Автоматичне надсилання ще не ввімкнено/)).not.toBeInTheDocument()
  expect(screen.getByText(/10.11.2026/)).toBeInTheDocument()
  await userEvent.clear(screen.getByLabelText('Ім’я'))
  await userEvent.type(screen.getByLabelText('Ім’я'), 'A')
  await userEvent.click(screen.getByRole('button', { name: 'Зберегти профіль' }))
  expect(profileService.save).not.toHaveBeenCalled()
  expect(screen.getByText(/від 2 до 40/)).toBeInTheDocument()
  await userEvent.clear(screen.getByLabelText('Ім’я')); await userEvent.type(screen.getByLabelText('Ім’я'), 'Нове ім’я')
  await userEvent.click(screen.getByLabelText('Хочу отримувати нагадування'))
  await userEvent.click(screen.getByRole('button', { name: 'Зберегти профіль' }))
  await screen.findByText('Профіль збережено.')
  expect(profileService.save).toHaveBeenCalledWith({ name: 'Нове ім’я', remindersEnabled: true }, { avatarFile: null, removeAvatar: false, previousAvatar: null })
  expect(refreshAccess).toHaveBeenCalled()
})
test('invalid format or oversize file gives an error; valid photo is previewed and saved', async () => {
  mount(); const input = await screen.findByLabelText('Обрати фото')
  fireEvent.change(input, { target: { files: [new File(['svg'], 'x.svg', { type: 'image/svg+xml' })] } })
  await screen.findByText(/Оберіть зображення JPEG/)
  fireEvent.change(input, { target: { files: [new File([new Uint8Array(1048577)], 'x.png', { type: 'image/png' })] } })
  await screen.findByText(/від 1 байта до 1 MB/)
  const file = new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'x.png', { type: 'image/png' })
  fireEvent.change(input, { target: { files: [file] } })
  await screen.findByRole('img', { name: 'Попередній перегляд нового фото' })
  await userEvent.click(screen.getByRole('button', { name: 'Зберегти профіль' }))
  await screen.findByText('Профіль збережено.')
  expect(profileService.save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ avatarFile: file }))
})
test('photo removal is staged until save and can be cancelled', async () => {
  profile.avatarPath = path
  mount(); await screen.findByLabelText('Ім’я')
  await userEvent.click(screen.getByRole('button', { name: 'Видалити фото' }))
  expect(profileService.save).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Скасувати зміну фото' }))
  expect(screen.queryByText('Фото буде видалено після збереження.')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Видалити фото' }))
  await userEvent.click(screen.getByRole('button', { name: 'Зберегти профіль' }))
  await screen.findByText('Профіль збережено.')
  expect(profileService.save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ removeAvatar: true, previousAvatar: path }))
})
test('failed read retries; failed save preserves fields and double clicks are suppressed', async () => {
  profileService.get.mockRejectedValueOnce(new Error('network'))
  mount(); await screen.findByRole('alert')
  await userEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  await screen.findByLabelText('Ім’я')
  let reject
  profileService.save.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail }))
  const save = screen.getByRole('button', { name: 'Зберегти профіль' })
  fireEvent.click(save); fireEvent.click(save)
  expect(profileService.save).toHaveBeenCalledTimes(1)
  await act(async () => reject(new Error('network')))
  expect(screen.getByLabelText('Ім’я')).toHaveValue('Читач')
})
test('changing identity never renders the prior profile or pending response', async () => {
  let resolve
  profileService.get.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
  const view = mount()
  useAuth.mockReturnValue({ user: { id: 'b', name: 'Інша людина' }, refreshAccess })
  profileService.get.mockResolvedValue({ ...profile, id: 'b', name: 'Інша людина' })
  view.rerender(<MemoryRouter><Routes><Route path="profile" element={<ProfilePage />} /></Routes></MemoryRouter>)
  await screen.findByLabelText('Ім’я')
  await act(async () => resolve(profile))
  expect(screen.getByLabelText('Ім’я')).toHaveValue('Інша людина')
})
test('my clubs deduplicates owner membership, separates archives and excludes admin-visible strangers', async () => {
  useAuth.mockReturnValue({ user: { id: 'a', role: 'admin' } })
  const base = { description: 'Читаємо разом.', genre: 'Проза', format: 'online', language: 'Українська', meetingsPerMonth: 2, membersCount: 1 }
  useClubs.mockReturnValue({ status: 'success', reload: vi.fn(), clubs: [
    { ...base, id: 'own', name: 'Власний', ownerId: 'a', isMember: true },
    { ...base, id: 'joined', name: 'Спільний', ownerId: 'b', isMember: true },
    { ...base, id: 'archived', name: 'Архівний', ownerId: 'b', isMember: true, archivedAt: '2026-11-11' },
    { ...base, id: 'stranger', name: 'Чужий', ownerId: 'b', isMember: false },
  ] })
  mount('/my-clubs')
  expect(screen.getAllByRole('link', { name: 'Власний' })).toHaveLength(1)
  expect(within(screen.getByRole('region', { name: 'Участь в інших клубах' })).getByRole('link', { name: 'Спільний' })).toHaveAttribute('href', '/clubs/joined')
  expect(screen.queryByText('Чужий')).not.toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Архівні клуби' })).getByText('Учасник')).toHaveClass('meta-tag')
  expect(screen.queryByRole('button', { name: /Обрати/ })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Мої заявки' })).toHaveAttribute('href', '/requests')
})
test('my clubs empty/error states support reload', async () => {
  const reload = vi.fn()
  useClubs.mockReturnValue({ clubs: [], status: 'error', error: 'Помилка каталогу', reload })
  const view = mount('/my-clubs')
  expect(screen.getByRole('alert')).toHaveTextContent('Помилка каталогу')
  await userEvent.click(screen.getByRole('button', { name: 'Оновити клуби' })); expect(reload).toHaveBeenCalled()
  useClubs.mockReturnValue({ clubs: [], status: 'success', reload })
  view.rerender(<MemoryRouter><Routes><Route path="my-clubs" element={<MyClubsPage />} /></Routes></MemoryRouter>)
  await waitFor(() => expect(screen.getByText(/У вас поки немає активних створених клубів/)).toBeInTheDocument())
})

test('only archived owned clubs show the active empty states and an owner badge without duplicates', () => {
  useClubs.mockReturnValue({ status: 'success', reload: vi.fn(), clubs: [
    { id: 'old-own', name: 'Мій архів', ownerId: 'a', isMember: true, archivedAt: '2026-11-11', genre: 'Проза', format: 'online', membersCount: 1 },
    { id: 'old-stranger', name: 'Чужий архів', ownerId: 'b', isMember: false, archivedAt: '2026-11-11' },
  ] })
  mount('/my-clubs')
  expect(within(screen.getByRole('region', { name: 'Створені мною' })).getByText('У вас поки немає активних створених клубів. Архівовані клуби можна переглянути в розділі "Архівні".')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Участь в інших клубах' })).getByText(/немає активних членств/)).toBeInTheDocument()
  const archive = within(screen.getByRole('region', { name: 'Архівні клуби' }))
  expect(archive.getByText('Власник')).toHaveClass('meta-tag')
  expect(archive.getByRole('link', { name: 'Мій архів' })).toHaveAttribute('href', '/clubs/old-own')
  expect(screen.getAllByRole('link', { name: 'Мій архів' })).toHaveLength(1)
  expect(screen.queryByText('Учасник')).not.toBeInTheDocument()
  expect(screen.queryByText('Чужий архів')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Обрати/ })).not.toBeInTheDocument()
})
