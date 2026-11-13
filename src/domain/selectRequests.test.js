import { expect, test } from 'vitest'
import { selectRequests } from './selectRequests.js'
import { testClub, savedRequest } from '../test/fixtures.js'

const clubs = [testClub]

function freezeAll(records) {
  return Object.freeze(records.map((record) => Object.freeze(record)))
}

test('поєднує пошук, нагадування й порядок без зміни джерела', () => {
  const records = freezeAll([
    { ...savedRequest, id: 'r-1', weeklyHours: 4 },
    { ...savedRequest, id: 'r-2', weeklyHours: 1 },
    { ...savedRequest, id: 'r-3', wantsReminders: false },
  ])

  const result = selectRequests(records, clubs, {
    query: ' ПРОЗУ ', reminders: 'yes', sort: 'hours-asc',
  })

  expect(result.map((record) => record.id)).toEqual(['r-2', 'r-1'])
  expect(records.map((record) => record.id)).toEqual(['r-1', 'r-2', 'r-3'])
})

test('фільтрує за досвідом, форматом участі та клубом', () => {
  const records = freezeAll([
    { ...savedRequest, id: 'r-1', experience: 'advanced', participationFormat: 'offline' },
    { ...savedRequest, id: 'r-2', experience: 'advanced', participationFormat: 'online' },
    { ...savedRequest, id: 'r-3', experience: 'beginner', participationFormat: 'offline' },
    { ...savedRequest, id: 'r-4', experience: 'advanced', participationFormat: 'offline', clubId: 'club-002' },
  ])

  const result = selectRequests(records, clubs, {
    experience: 'advanced', format: 'offline', club: 'club-001',
  })

  expect(result.map((record) => record.id)).toEqual(['r-1'])
})

test('сортує за датою створення від нових до старих', () => {
  const records = freezeAll([
    { ...savedRequest, id: 'r-old', createdAt: '2026-09-01T10:00:00.000Z' },
    { ...savedRequest, id: 'r-new', createdAt: '2026-10-09T10:00:00.000Z' },
    { ...savedRequest, id: 'r-mid', createdAt: '2026-09-20T10:00:00.000Z' },
  ])

  const result = selectRequests(records, clubs, { sort: 'newest' })

  expect(result.map((record) => record.id)).toEqual(['r-new', 'r-mid', 'r-old'])
})

test('для однакових значень порядок стабільний за id', () => {
  const records = freezeAll([
    { ...savedRequest, id: 'r-b', weeklyHours: 3 },
    { ...savedRequest, id: 'r-a', weeklyHours: 3 },
  ])

  const result = selectRequests(records, clubs, { sort: 'hours-desc' })

  expect(result.map((record) => record.id)).toEqual(['r-a', 'r-b'])
})

test('відсутність збігів не видаляє початковий запис', () => {
  const records = [savedRequest]

  const result = selectRequests(records, clubs, { query: 'несумісний пошуковий текст' })

  expect(result).toEqual([])
  expect(records).toEqual([savedRequest])
})