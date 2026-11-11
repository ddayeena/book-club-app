import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import ClubBooksPage from './ClubBooksPage.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import { bookService } from '../services/bookService.js'
import BookCover from '../components/books/BookCover.jsx'
import { ServiceError } from '../services/ServiceError.js'
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useClubs.js', () => ({ default: vi.fn() }))
vi.mock('../services/bookService.js', () => ({ bookService: { getAll: vi.fn(), save: vi.fn(), start: vi.fn(), complete: vi.fn() } }))
const club = { id: 'c', ownerId: 'owner', name: 'Наш клуб' }
const current = { id: 'current', title: 'Поточна книга', author: null, isMigrated: true, status: 'current' }
const planned = { id: 'planned', title: 'Майбутня книга', author: 'Автор', status: 'planned' }
const reload = vi.fn()
function mount(path = '/clubs/c/books') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/clubs/:clubId/books" element={<ClubBooksPage />} /></Routes></MemoryRouter>)
}
beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ user: { id: 'owner', role: 'user' } })
  useClubs.mockReturnValue({ clubs: [club], reload })
  bookService.getAll.mockResolvedValue([current, planned])
  bookService.save.mockResolvedValue(planned)
  bookService.start.mockResolvedValue({ ...planned, status: 'current' })
  bookService.complete.mockResolvedValue({ ...current, status: 'completed' })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => vi.restoreAllMocks())
test('гість бачить книги без інструментів редагування', async () => {
  useAuth.mockReturnValue({ user: null })
  mount()
  expect(await screen.findByText('Поточна книга')).toBeInTheDocument()
  expect(screen.getByText('Автор не вказаний')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Додати книгу' })).not.toBeInTheDocument()
})
test('фільтр із URL показує тільки заплановані книги', async () => {
  mount('/clubs/c/books?status=planned')
  expect(await screen.findByText('Майбутня книга')).toBeInTheDocument()
  expect(screen.queryByText('Поточна книга')).not.toBeInTheDocument()
})
test('не замінює поточну книгу без явного рішення', async () => {
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Почати читання' }))
  expect(screen.getByRole('button', { name: 'Підтвердити заміну' })).toBeDisabled()
  expect(bookService.start).not.toHaveBeenCalled()
  await userEvent.click(screen.getByLabelText('Повернути до запланованих'))
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити заміну' }))
  expect(bookService.start).toHaveBeenCalledWith('planned', 'current', 'planned')
  expect(reload).toHaveBeenCalledWith(true)
})
test('архівна полиця та чужий admin доступні тільки для читання', async () => {
  useAuth.mockReturnValue({ user: { id: 'admin', role: 'admin' } })
  useClubs.mockReturnValue({ clubs: [{ ...club, archivedAt: '2026-11-11' }], reload })
  mount()
  await screen.findByText('Поточна книга')
  expect(screen.queryByRole('button', { name: 'Редагувати' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Завершити читання' })).not.toBeInTheDocument()
})
test('форма вимагає автора для нової книги', async () => {
  mount()
  await screen.findByText('Поточна книга')
  await userEvent.click(screen.getByRole('button', { name: 'Додати книгу' }))
  const form = within(screen.getByRole('form', { name: 'Форма книги' }))
  await userEvent.type(form.getByLabelText('Назва книги'), 'Нова книга')
  await userEvent.click(form.getByRole('button', { name: 'Зберегти книгу' }))
  expect(form.getByText('Вкажіть автора (до 120 символів).')).toBeInTheDocument()
  expect(bookService.save).not.toHaveBeenCalled()
  await userEvent.type(form.getByLabelText('Автор'), 'Письменник')
  await userEvent.click(form.getByRole('button', { name: 'Зберегти книгу' }))
  expect(bookService.save).toHaveBeenCalledWith('c', expect.objectContaining({ title: 'Нова книга', author: 'Письменник' }), null)
})
test('після відмови збереження форма зберігає введення', async () => {
  bookService.save.mockRejectedValue(new ServiceError('Немає доступу'))
  mount()
  await screen.findByText('Поточна книга')
  await userEvent.click(screen.getByRole('button', { name: 'Додати книгу' }))
  await userEvent.type(screen.getByLabelText('Назва книги'), 'Нова книга')
  await userEvent.type(screen.getByLabelText('Автор'), 'Автор')
  await userEvent.click(screen.getByRole('button', { name: 'Зберегти книгу' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Немає доступу')
  expect(screen.getByLabelText('Назва книги')).toHaveValue('Нова книга')
})
test('недоступна обкладинка перетворюється на заглушку', () => {
  render(<BookCover url="https://example.com/cover.jpg" title="Книга" />)
  const image = screen.getByRole('img', { name: 'Обкладинка: Книга' })
  expect(image).toHaveAttribute('referrerpolicy', 'no-referrer')
  fireEvent.error(image)
  expect(screen.getByRole('img', { name: 'Обкладинки немає' })).toBeInTheDocument()
})
