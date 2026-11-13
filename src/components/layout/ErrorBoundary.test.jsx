import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary.jsx'

function Broken() {
  throw new Error('Навмисна помилка рендерингу')
}

test('показує резервний інтерфейс замість білого екрана', () => {
  // React виводить очікувану помилку в консоль; ми приховуємо її, щоб не засмічувати вивід тестів
  vi.spyOn(console, 'error').mockImplementation(() => {})

  render(
    <ErrorBoundary resetKey="/">
      <Broken />
    </ErrorBoundary>,
  )

  expect(screen.getByRole('alert')).toHaveTextContent('Щось пішло не так')
  expect(screen.getByRole('button', { name: 'Оновити сторінку' })).toBeInTheDocument()
})

test('без помилки просто показує вміст', () => {
  render(
    <ErrorBoundary resetKey="/">
      <p>Звичайний вміст</p>
    </ErrorBoundary>,
  )

  expect(screen.getByText('Звичайний вміст')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})