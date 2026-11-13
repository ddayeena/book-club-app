import { expect, test } from 'vitest'
import { validatePoll, pollLeaders, votePercent } from './pollValidation.js'

test('validates distinct choices and a future deadline without trusting extra fields', () => {
  const now = Date.parse('2026-11-11T10:00Z')
  const draft = { title: ' Наступна книга ', endsAt: '2026-11-12T12:00Z', bookIds: ['a', 'b'] }
  expect(validatePoll(draft, now)).toMatchObject({ ok: true, value: { title: 'Наступна книга', endsAt: '2026-11-12T12:00:00.000Z' } })
  for (const bookIds of [[], ['a'], ['a', 'a']]) expect(validatePoll({ ...draft, bookIds }, now).errors.bookIds).toBeTruthy()
  expect(validatePoll({ ...draft, endsAt: 'invalid' }, now).ok).toBe(false)
  expect(validatePoll({ ...draft, endsAt: '2026-11-11T10:00Z' }, now).ok).toBe(false)
  expect(validatePoll({ ...draft, title: '  ' }, now).ok).toBe(false)
})
test('leaders handle a sole winner, ties and no votes; percentages handle zero', () => {
  expect(pollLeaders([{ id: 'a', votes: 2 }, { id: 'b', votes: 1 }]).map((o) => o.id)).toEqual(['a'])
  expect(pollLeaders([{ votes: 1 }, { votes: 1 }])).toHaveLength(2)
  expect(pollLeaders([{ votes: 0 }, { votes: 0 }])).toHaveLength(2)
  expect(votePercent(0, 0)).toBe(0)
  expect(votePercent(1, 3)).toBe(33.3)
})
