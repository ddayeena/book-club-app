import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import ClubsProvider from './ClubsProvider.jsx'
import useClubs from '../hooks/useClubs.js'
import useAuth from '../hooks/useAuth.js'
import { clubService } from '../services/clubService.js'
import { deferred } from '../test/deferred.js'
import { ServiceError } from '../services/ServiceError.js'
vi.mock('../services/dataSource.js', () => ({ isSupabaseData: true }))
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../services/clubService.js', () => ({ clubService: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), archive: vi.fn() } }))
function Probe() {
  const { clubs, status, error, createClub, reload } = useClubs()
  return <><p>{status}</p><p>{error}</p>{clubs.map((club) => <p key={club.id}>{club.name}</p>)}
    <button onClick={() => void createClub({ name: 'Новий' })}>Створити</button>
    <button onClick={() => void reload()}>Повтор</button>
  </>
}
beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ user: { id: 'a' } })
  clubService.getAll.mockResolvedValue([])
})
test('асинхронний каталог має початкове завантаження', async () => {
  const pending = deferred()
  clubService.getAll.mockReturnValue(pending.promise)
  render(<ClubsProvider><Probe /></ClubsProvider>)
  expect(screen.getByText('loading')).toBeInTheDocument()
  await act(async () => { pending.resolve([{ id: 'c', name: 'Віддалений клуб' }]) })
  expect(await screen.findByText('Віддалений клуб')).toBeInTheDocument()
})
test('відмова читання не підставляє localStorage та дозволяє повтор', async () => {
  clubService.getAll.mockRejectedValueOnce(new ServiceError('Помилка читання'))
  render(<ClubsProvider><Probe /></ClubsProvider>)
  expect(await screen.findByText('Помилка читання')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Повтор'))
  expect(await screen.findByText('success')).toBeInTheDocument()
})
test('після створення перечитує підтверджений каталог', async () => {
  clubService.create.mockResolvedValue({ id: 'new', name: 'Новий' })
  clubService.getAll.mockResolvedValueOnce([]).mockResolvedValue([{ id: 'new', name: 'Новий' }])
  render(<ClubsProvider><Probe /></ClubsProvider>)
  await screen.findByText('success')
  await userEvent.click(screen.getByText('Створити'))
  expect(await screen.findByText('Новий')).toBeInTheDocument()
})
test('зміна користувача скидає каталог і відкидає попередню відповідь', async () => {
  const pending = deferred()
  clubService.getAll.mockReturnValueOnce(pending.promise).mockResolvedValue([{ id: 'b', name: 'Клуб B' }])
  const view = render(<ClubsProvider><Probe /></ClubsProvider>)
  await act(async () => {})
  useAuth.mockReturnValue({ user: { id: 'b' } })
  view.rerender(<ClubsProvider><Probe /></ClubsProvider>)
  expect(await screen.findByText('Клуб B')).toBeInTheDocument()
  await act(async () => { pending.resolve([{ id: 'a', name: 'Приватний архів A' }]) })
  expect(screen.queryByText('Приватний архів A')).not.toBeInTheDocument()
})
