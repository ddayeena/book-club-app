import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import UserAvatar from './UserAvatar.jsx'
import { profileService } from '../../services/profileService.js'
vi.mock('../../services/profileService.js', () => ({ profileService: { signedAvatar: vi.fn() } }))
const user = { id: 'a', name: 'Ірина Читач', avatarPath: 'a/00000000-0000-4000-8000-000000000001.png' }
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks() })
test('initials cover missing paths, failed signing and broken images', async () => {
  const view = render(<UserAvatar user={{ ...user, avatarPath: null }} />)
  expect(screen.getByRole('img')).toHaveTextContent('ІЧ')
  expect(profileService.signedAvatar).not.toHaveBeenCalled()
  profileService.signedAvatar.mockRejectedValue(new Error('network'))
  view.rerender(<UserAvatar user={user} />)
  await act(async () => {})
  expect(screen.getByRole('img')).toHaveTextContent('ІЧ')
  profileService.signedAvatar.mockResolvedValue('https://example.test/avatar')
  fireEvent.focus(window); await act(async () => {})
  const image = screen.getByRole('img').querySelector('img')
  fireEvent.error(image)
  expect(screen.getByRole('img')).toHaveTextContent('ІЧ')
})
test('renews short-lived URL and never reuses a previous account image', async () => {
  vi.useFakeTimers()
  profileService.signedAvatar.mockResolvedValue('https://example.test/first')
  const view = render(<UserAvatar user={user} />)
  await act(async () => {})
  expect(profileService.signedAvatar).toHaveBeenCalledTimes(1)
  await act(async () => vi.advanceTimersByTime(105000))
  expect(profileService.signedAvatar).toHaveBeenCalledTimes(2)
  view.rerender(<UserAvatar user={{ id: 'b', name: 'Богдан', avatarPath: user.avatarPath }} />)
  expect(screen.getByRole('img')).toHaveTextContent('Б')
  expect(screen.getByRole('img').querySelector('img')).toBeNull()
})
