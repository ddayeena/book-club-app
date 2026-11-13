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

test.each([
  ['UA', 'Українська'], ['EN', 'Англійська'], ['UA+EN', 'Українська та англійська'],
])('language %s accepts actual database names and equivalent short codes', (code, language) => {
  const input = [{ ...ownClub, id: 'db', language }, { ...ownClub, id: 'short', language: code }, { ...ownClub, id: 'bad', language: 'unknown' }]
  expect(selectClubs(input, { language: code }).map((c) => c.id)).toEqual(['db', 'short'])
})
test.each([['up-to-5', [0, 5]], ['6-10', [6, 10]], ['11-20', [11, 20]], ['over-20', [21]]])('member range %s uses exact inclusive bounds', (members, counts) => {
  const input = [0, 5, 6, 10, 11, 20, 21].map((membersCount) => ({ ...ownClub, id: String(membersCount), membersCount }))
  expect(selectClubs(input, { members }).map((c) => c.membersCount).sort((a, b) => a - b)).toEqual(counts)
})
test('invalid member counts remain visible with any range, but never match a numeric range', () => {
  const input = [undefined, null, NaN, Infinity, -1, 1.5, '5'].map((membersCount, index) => ({ ...ownClub, id: String(index), membersCount }))
  expect(selectClubs(input, { members: 'all' })).toHaveLength(input.length)
  for (const members of ['up-to-5', '6-10', '11-20', 'over-20']) expect(selectClubs(input, { members })).toHaveLength(0)
})
test('future meeting uses precise clock, ignores legacy/date-only/malformed instants and excludes exact start', () => {
  const now = Date.parse('2030-01-01T12:00:00Z')
  const times = ['2030-01-01T12:00:00.001Z', '2030-01-01T14:30:00+02:00', '2030-01-01T12:00:00Z', '2030-01-01T11:59:59Z', null, undefined, 'invalid', '2030-02-30T12:00:00Z', '2030-01-02', '2030-01-02T12:00:00']
  const input = times.map((nextMeetingAt, index) => ({ ...ownClub, id: String(index), nextMeetingAt, nextMeeting: '2030-01-02' }))
  expect(selectClubs(input, { meetingOnly: true, now }).map((c) => c.id)).toEqual(['0', '1'])
})
test('genre comparison ignores case and boundary spaces, and all filters combine', () => {
  const matching = { ...ownClub, id: 'match', name: 'Фентезі друзі', genre: ' фентезі ', language: 'Українська та англійська', membersCount: 10, currentBook: 'Книга', nextMeetingAt: '2030-01-02T12:00:00Z' }
  const input = [matching, { ...matching, id: 'other-language', language: 'Англійська' }, { ...matching, id: 'other-owner', ownerId: 'other' }]
  expect(selectClubs(input, { query: 'друзі', genre: 'Фентезі', language: 'UA+EN', members: '6-10', meetingOnly: true, now: Date.parse('2030-01-01T00:00:00Z'), readingOnly: true, ownerId: ownClub.ownerId, format: 'offline' }).map((c) => c.id)).toEqual(['match'])
})
