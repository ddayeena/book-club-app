import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import ClubPollPage from './ClubPollPage.jsx'
import ClubPollsPage from './ClubPollsPage.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import { pollService } from '../services/pollService.js'
import { bookService } from '../services/bookService.js'
import BookCard from '../components/books/BookCard.jsx'
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../hooks/useClubs.js', () => ({ default: vi.fn() }))
vi.mock('../services/pollService.js', () => ({ pollService: { get: vi.fn(), list: vi.fn(), create: vi.fn(), vote: vi.fn(), finalize: vi.fn(), cancel: vi.fn() } }))
vi.mock('../services/bookService.js', () => ({ bookService: { getAll: vi.fn() } }))
const club = { id: 'c', ownerId: 'owner', name: 'Читаємо', isMember: true }
const options = [{ id: 'a', bookId: 'one', title: 'Перша', votes: 1 }, { id: 'b', bookId: 'two', title: 'Друга', votes: 1 }]
let poll
function mount(path = '/clubs/c/polls/p') {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/clubs/:clubId/polls/:pollId" element={<ClubPollPage />} />
    <Route path="/clubs/:clubId/polls" element={<ClubPollsPage />} />
  </Routes></MemoryRouter>)
}
beforeEach(() => {
  vi.resetAllMocks()
  poll = { id: 'p', clubId: 'c', title: 'Що читаємо?', status: 'open', endsAt: '2099-01-01', serverNow: new Date().toISOString(), receivedAt: Date.now(),
    options, totalVotes: 2, canVote: true, canCancel: false, canFinalize: false, myOptionId: 'a' }
  useAuth.mockReturnValue({ user: { id: 'member', role: 'user' } })
  useClubs.mockReturnValue({ clubs: [club], reload: vi.fn().mockResolvedValue(undefined) })
  pollService.get.mockImplementation(async () => poll)
  pollService.list.mockResolvedValue([])
  bookService.getAll.mockResolvedValue(options.map((o) => ({ id: o.bookId, title: o.title, author: 'Автор', status: 'planned' })))
})
test('restores own vote on F5, changes one choice and suppresses duplicate clicks', async () => {
  let resolve
  pollService.vote.mockImplementation(() => new Promise((r) => { resolve = r }))
  mount()
  const form = await screen.findByRole('form', { name: 'Ваш голос' })
  expect(within(form).getByLabelText(/Перша/)).toBeChecked()
  await userEvent.click(within(form).getByLabelText(/Друга/))
  const button = screen.getByRole('button', { name: 'Змінити голос' })
  fireEvent.click(button); fireEvent.click(button)
  expect(pollService.vote).toHaveBeenCalledTimes(1)
  expect(pollService.vote).toHaveBeenCalledWith('p', 'b')
  poll = { ...poll, myOptionId: 'b' }; resolve()
  expect(await screen.findByText('Ваш вибір: Друга')).toBeInTheDocument()
})
test('nonmember admin has results without vote or owner controls', async () => {
  useAuth.mockReturnValue({ user: { id: 'admin', role: 'admin' } })
  poll.canVote = false
  mount()
  await screen.findByRole('heading', { name: 'Результати' })
  expect(screen.queryByRole('form', { name: 'Ваш голос' })).not.toBeInTheDocument()
  expect(screen.queryByText('Скасувати голосування')).not.toBeInTheDocument()
  expect(screen.getAllByText(/50%/)).toHaveLength(2)
})
test.each([0, 2])('owner explicitly chooses a winner with %i total votes', async (totalVotes) => {
  poll = { ...poll, status: 'closed', canVote: false, canFinalize: true, totalVotes,
    options: options.map((o) => ({ ...o, votes: totalVotes / 2 })) }
  mount()
  const panel = await screen.findByRole('region', { name: 'Фіксація результату' })
  const button = within(panel).getByRole('button', { name: 'Зафіксувати переможця' })
  expect(button).toBeDisabled()
  await userEvent.click(within(panel).getByLabelText('Друга'))
  pollService.finalize.mockImplementation(async () => { poll = { ...poll, canFinalize: false, status: 'finalized', winnerOptionId: 'b' } })
  await userEvent.click(button)
  expect(pollService.finalize).toHaveBeenCalledWith('p', 'b')
  await screen.findByText(/Переможця зафіксовано/)
})
test('cancellation requires inline confirmation and keeps history', async () => {
  poll.canCancel = true
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Скасувати голосування' }))
  expect(pollService.cancel).not.toHaveBeenCalled()
  expect(screen.getByRole('alertdialog')).toHaveTextContent('залишаться в історії')
  await userEvent.click(screen.getByRole('button', { name: 'Залишити голосування' }))
  expect(pollService.cancel).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Скасувати голосування' }))
  pollService.cancel.mockImplementation(async () => { poll = { ...poll, status: 'cancelled', canVote: false, canCancel: false } })
  await userEvent.click(screen.getByRole('button', { name: 'Підтвердити скасування' }))
  await screen.findByText('Скасовано')
  expect(pollService.cancel).toHaveBeenCalledWith('p')
  expect(screen.getByRole('heading', { name: 'Результати' })).toBeInTheDocument()
})
test('expired unresolved poll blocks creation; archive never shows creation', async () => {
  useAuth.mockReturnValue({ user: { id: 'owner' } })
  pollService.list.mockResolvedValue([{ ...poll, status: 'closed' }])
  mount('/clubs/c/polls')
  await screen.findByText(/Спочатку завершіть/)
  expect(screen.queryByRole('form', { name: 'Нове голосування' })).not.toBeInTheDocument()
})
test('owner form requires two books, then creates and navigates to detail', async () => {
  useAuth.mockReturnValue({ user: { id: 'owner' } })
  pollService.create.mockResolvedValue({ id: 'p' })
  mount('/clubs/c/polls')
  const form = await screen.findByRole('form', { name: 'Нове голосування' })
  fireEvent.change(within(form).getByLabelText('Назва голосування'), { target: { value: 'Наступна книга' } })
  fireEvent.change(within(form).getByLabelText('Завершення голосування'), { target: { value: '2099-01-01T12:00' } })
  await userEvent.click(within(form).getByRole('button', { name: 'Створити голосування' }))
  expect(pollService.create).not.toHaveBeenCalled()
  await userEvent.click(within(form).getByLabelText(/Перша/)); await userEvent.click(within(form).getByLabelText(/Друга/))
  await userEvent.click(within(form).getByRole('button', { name: 'Створити голосування' }))
  await screen.findByRole('heading', { name: 'Що читаємо?' })
  expect(pollService.create).toHaveBeenCalledWith('c', expect.objectContaining({ bookIds: ['one', 'two'] }))
})
test('read failures allow retry; a poll from another club never renders controls', async () => {
  pollService.get.mockRejectedValueOnce(new Error('network'))
  mount()
  await screen.findByRole('alert')
  poll = { ...poll, clubId: 'other' }
  await userEvent.click(screen.getByRole('button', { name: 'Оновити голосування' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('не належить'))
  expect(screen.queryByRole('form', { name: 'Ваш голос' })).not.toBeInTheDocument()
})
test('bookshelf marks selected book and locks controls for unresolved options', () => {
  render(<BookCard book={{ title: 'Книга', status: 'planned', isPollLocked: true, isNextSelected: true }} canManage busy={false} />)
  expect(screen.getByText('Наступна обрана книга')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Редагувати' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Почати читання' })).toBeDisabled()
})
test('archived club displays history without creation or voting controls', async () => {
  useAuth.mockReturnValue({ user: { id: 'owner' } })
  useClubs.mockReturnValue({ clubs: [{ ...club, archivedAt: '2026-11-11' }], reload: vi.fn() })
  pollService.list.mockResolvedValue([{ ...poll, status: 'cancelled', cancelledAt: '2026-11-11', canVote: false }])
  mount('/clubs/c/polls')
  await screen.findByRole('heading', { name: 'Голосування клубу' })
  expect(screen.queryByRole('form', { name: 'Нове голосування' })).not.toBeInTheDocument()
  expect(screen.getByText('Скасовано')).toBeInTheDocument()
})
test('failed refresh after a saved vote does not encourage resubmitting it', async () => {
  mount()
  const form = await screen.findByRole('form', { name: 'Ваш голос' })
  await userEvent.click(within(form).getByLabelText(/Друга/))
  pollService.get.mockRejectedValueOnce(new Error('network'))
  await userEvent.click(screen.getByRole('button', { name: 'Змінити голос' }))
  await screen.findByText(/Зміну збережено. Оновіть/)
  expect(pollService.vote).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('form', { name: 'Ваш голос' })).not.toBeInTheDocument()
  poll = { ...poll, myOptionId: 'b' }
  await userEvent.click(screen.getByRole('button', { name: 'Оновити голосування' }))
  expect(await screen.findByText('Ваш вибір: Друга')).toBeInTheDocument()
})
