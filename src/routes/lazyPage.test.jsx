import { Suspense, useEffect } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { lazyPage } from './lazyPage.js'
import ErrorBoundary from '../components/layout/ErrorBoundary.jsx'
import PageLoading from '../components/layout/PageLoading.jsx'
import { deferred } from '../test/deferred.js'

afterEach(() => vi.restoreAllMocks())

test('deferred page preserves shell and provider while showing an accessible fallback', async () => {
  const pending = deferred(), mount = vi.fn(), unmount = vi.fn()
  const load = vi.fn(() => pending.promise), Page = lazyPage(load, 'Page')
  function Provider({ children }) {
    useEffect(() => { mount(); return unmount }, [])
    return children
  }
  render(<Provider><nav>Навігація</nav><main><Suspense fallback={<PageLoading />}><Page /></Suspense></main></Provider>)
  expect(screen.getByRole('navigation')).toHaveTextContent('Навігація')
  expect(screen.getByRole('status')).toHaveTextContent('Завантаження сторінки')
  expect(load).toHaveBeenCalledTimes(1)
  await act(async () => pending.resolve({ Page: () => <h1>Готова сторінка</h1> }))
  expect(await screen.findByRole('heading', { name: 'Готова сторінка' })).toBeInTheDocument()
  expect(mount).toHaveBeenCalledTimes(1)
  expect(unmount).not.toHaveBeenCalled()
})

test('chunk failure provides a manual reload without automatic retry; another route recovers', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const load = vi.fn().mockRejectedValue(new TypeError('Failed to fetch dynamically imported module'))
  const Broken = lazyPage(load, 'Page')
  const view = render(<ErrorBoundary resetKey="broken"><Suspense fallback={<PageLoading />}><Broken /></Suspense></ErrorBoundary>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Не вдалося завантажити сторінку')
  expect(screen.getByRole('button', { name: 'Оновити сторінку' })).toBeEnabled()
  expect(screen.getByRole('alert')).toHaveTextContent('попередня версія файлів')
  expect(load).toHaveBeenCalledTimes(1)
  view.rerender(<ErrorBoundary resetKey="other"><h1>Інший розділ</h1></ErrorBoundary>)
  expect(screen.getByRole('heading', { name: 'Інший розділ' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('fresh module instance after a page reload can recover from a failed chunk', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const loader = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ Page: () => <h1>Відновлено</h1> })
  const Failed = lazyPage(loader, 'Page')
  const view = render(<ErrorBoundary><Suspense fallback={<PageLoading />}><Failed /></Suspense></ErrorBoundary>)
  await screen.findByRole('alert')
  view.unmount()
  const Fresh = lazyPage(loader, 'Page')
  render(<ErrorBoundary><Suspense fallback={<PageLoading />}><Fresh /></Suspense></ErrorBoundary>)
  expect(await screen.findByRole('heading', { name: 'Відновлено' })).toBeInTheDocument()
  expect(loader).toHaveBeenCalledTimes(2)
})

test('loaded module is reused across rerenders', async () => {
  const load = vi.fn(async () => ({ Page: () => <button>Дія сторінки</button> }))
  const Page = lazyPage(load, 'Page')
  const view = render(<Suspense fallback={<PageLoading />}><Page /></Suspense>)
  await userEvent.click(await screen.findByRole('button', { name: 'Дія сторінки' }))
  view.rerender(<Suspense fallback={<PageLoading />}><Page /></Suspense>)
  expect(load).toHaveBeenCalledTimes(1)
})
