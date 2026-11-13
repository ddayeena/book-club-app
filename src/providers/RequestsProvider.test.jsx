import { StrictMode } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import RequestsProvider from './RequestsProvider.jsx'
import useRequests from '../hooks/useRequests.js'
import useAuth from '../hooks/useAuth.js'
import { requestService } from '../services/requestService.js'
import { deferred } from '../test/deferred.js'
vi.mock('../hooks/useAuth.js', () => ({ default: vi.fn() }))
vi.mock('../services/dataSource.js', () => ({ isSupabaseData: true }))
vi.mock('../services/requestService.js', () => ({ requestService: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } }))
function Consumer() {
  const r = useRequests()
  return <><p>{r.status}</p>{r.requests.map(item => <p key={item.id}>{item.status}</p>)}
    <button onClick={() => r.createRequest({})}>Створити</button><button onClick={() => r.deleteRequest('r')}>Скасувати</button><button onClick={r.reload}>Оновити</button></>
}
beforeEach(() => {
  vi.clearAllMocks()
  useAuth.mockReturnValue({ user: { id: 'a', name: 'Alice' } })
  requestService.getAll.mockResolvedValue([{ id: 'r', status: 'pending' }])
})
test('profile name changes keep displayed requests without another fetch; mutation and reload stay current', async () => {
  const view = render(<RequestsProvider><Consumer /></RequestsProvider>)
  await screen.findByText('pending')
  useAuth.mockReturnValue({ user: { id: 'a', name: 'Updated' } })
  view.rerender(<RequestsProvider><Consumer /></RequestsProvider>)
  expect(screen.getByText('pending')).toBeInTheDocument()
  expect(requestService.getAll).toHaveBeenCalledTimes(1)
  requestService.delete.mockResolvedValue({ id: 'r', status: 'cancelled' })
  await userEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
  expect(await screen.findByText('cancelled')).toBeInTheDocument()
  requestService.create.mockResolvedValue({ id: 'new', status: 'new request' })
  await userEvent.click(screen.getByRole('button', { name: 'Створити' }))
  expect(await screen.findByText('new request')).toBeInTheDocument()
  requestService.getAll.mockResolvedValue([{ id: 'r', status: 'approved' }])
  await userEvent.click(screen.getByRole('button', { name: 'Оновити' }))
  expect(await screen.findByText('approved')).toBeInTheDocument()
  expect(screen.queryByText('new request')).not.toBeInTheDocument()
})
test('disabled provider defers reading and preserves data when consumers return', async () => {
  const view = render(<RequestsProvider enabled={false}><Consumer /></RequestsProvider>)
  expect(requestService.getAll).not.toHaveBeenCalled()
  view.rerender(<RequestsProvider enabled><Consumer /></RequestsProvider>)
  await screen.findByText('pending')
  view.rerender(<RequestsProvider enabled={false}><Consumer /></RequestsProvider>)
  view.rerender(<RequestsProvider enabled><Consumer /></RequestsProvider>)
  expect(screen.getByText('pending')).toBeInTheDocument()
  expect(requestService.getAll).toHaveBeenCalledTimes(1)
})
test('account switch and logout hide old records immediately and ignore stale responses', async () => {
  const late = deferred()
  const view = render(<RequestsProvider><Consumer /></RequestsProvider>)
  await screen.findByText('pending')
  requestService.getAll.mockReturnValueOnce(late.promise)
  await userEvent.click(screen.getByRole('button', { name: 'Оновити' }))
  useAuth.mockReturnValue({ user: { id: 'b' } })
  requestService.getAll.mockResolvedValue([{ id: 'b', status: 'Bob request' }])
  view.rerender(<RequestsProvider><Consumer /></RequestsProvider>)
  expect(screen.queryByText('pending')).not.toBeInTheDocument()
  await screen.findByText('Bob request')
  await act(async () => late.resolve([{ id: 'old', status: 'stale Alice' }]))
  expect(screen.queryByText('stale Alice')).not.toBeInTheDocument()
  useAuth.mockReturnValue({ user: null })
  view.rerender(<RequestsProvider><Consumer /></RequestsProvider>)
  expect(screen.queryByText('Bob request')).not.toBeInTheDocument()
  expect(screen.getByText('success')).toBeInTheDocument()
})
test('StrictMode replay still completes the active request', async () => {
  render(<StrictMode><RequestsProvider><Consumer /></RequestsProvider></StrictMode>)
  expect(await screen.findByText('pending')).toBeInTheDocument()
})
