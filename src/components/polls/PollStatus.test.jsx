import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import PollStatus from './PollStatus.jsx'

afterEach(() => vi.useRealTimers())
test('deadline follows server time despite a different device clock and cleans up its timer', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2030-01-01T00:00Z'))
  const onDeadline = vi.fn()
  const poll = { status: 'open', serverNow: '2026-11-11T10:00:00Z', endsAt: '2026-11-11T10:00:01Z', receivedAt: Date.now() }
  const view = render(<PollStatus poll={poll} onDeadline={onDeadline} />)
  act(() => vi.advanceTimersByTime(900))
  expect(onDeadline).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(151))
  expect(onDeadline).toHaveBeenCalledTimes(1)
  view.unmount()
  expect(vi.getTimerCount()).toBe(0)
})
test('closed polls explain why new voting cannot start automatically', () => {
  const onDeadline = vi.fn()
  render(<PollStatus poll={{ status: 'closed', endsAt: '2026-11-11T10:00Z' }} onDeadline={onDeadline} />)
  expect(screen.getByText(/Власник має зафіксувати/)).toBeInTheDocument()
  expect(onDeadline).not.toHaveBeenCalled()
})
