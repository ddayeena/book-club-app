import { expect, test } from 'vitest'
import { selectClubs } from './selectClubs.js'
import { clubs } from '../data/clubs.js'
import { ownClub } from '../test/fixtures.js'

const frozen = Object.freeze(clubs.map((club) => Object.freeze({ ...club })))

test('шукає за назвою, жанром і поточною книгою', () => {
  expect(selectClubs(frozen, { query: 'детектив' }).map((c) => c.id)).toContain('club-003')
  expect(selectClubs(frozen, { query: 'відьмак' }).map((c) => c.id)).toEqual(['club-004'])
  expect(selectClubs(frozen, { query: 'наукпоп' }).map((c) => c.id)).toEqual(['club-002'])
})

test('фільтр "лише читають" не показує клуби без книги', () => {
  const result = selectClubs(frozen, { readingOnly: true })

  expect(result.every((club) => club.currentBook)).toBe(true)
  expect(result.map((club) => club.id)).not.toContain('club-002')
})

test('поєднує формат і жанр', () => {
  const online = selectClubs(frozen, { format: 'online' })
  expect(online.every((club) => club.format === 'online')).toBe(true)

  const result = selectClubs(frozen, { format: 'online', genre: 'Фентезі' })
  expect(result.map((club) => club.id)).toEqual(['club-004'])
})

test('сортує за найближчою зустріччю та кількістю учасників', () => {
  const byMeeting = selectClubs(frozen, { sort: 'meeting-asc' })
  const dates = byMeeting.map((club) => club.nextMeeting)
  expect(dates).toEqual([...dates].sort())

  const byMembers = selectClubs(frozen, { sort: 'members-desc' })
  expect(byMembers[0].id).toBe('club-005')
})

test('не змінює вхідну колекцію', () => {
  const before = frozen.map((club) => club.id)
  selectClubs(frozen, { sort: 'members-desc' })
  expect(frozen.map((club) => club.id)).toEqual(before)
})

test('клуби без дати сортуються після клубів із датою', () => {
  const undated = { ...ownClub, id: 'undated', nextMeeting: null }
  const result = selectClubs([undated, ...frozen], { sort: 'meeting-asc' })
  expect(result.at(-1).id).toBe('undated')
})

test('сортує точні моменти, навіть коли місцеві дати організаторів мають інший порядок', () => {
  const first = { ...ownClub, id: 'first', nextMeeting: '2099-01-02', nextMeetingAt: '2099-01-01T12:00:00Z' }
  const second = { ...ownClub, id: 'second', nextMeeting: '2099-01-01', nextMeetingAt: '2099-01-01T13:00:00Z' }
  const undated = { ...ownClub, id: 'none', nextMeeting: null, nextMeetingAt: null, legacyNextMeeting: '2020-01-01' }
  expect(selectClubs([second, undated, first], { sort: 'meeting-asc' }).map((c) => c.id)).toEqual(['first', 'second', 'none'])
})
test('фільтр за власником показує лише клуби цього користувача', () => {
  const withOwner = [...frozen, ownClub]

  expect(selectClubs(withOwner, { ownerId: 'user-demo' }).map((club) => club.id))
    .toEqual(['club-own-1'])
  expect(selectClubs(withOwner, { ownerId: 'user-ніхто' })).toEqual([])
})
