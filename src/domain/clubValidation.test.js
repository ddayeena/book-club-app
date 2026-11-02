import { describe, expect, test } from 'vitest'
import { validateClub } from './clubValidation.js'

const valid = {
  name: 'Клуб нічного читання',
  genre: 'Фентезі',
  description: 'Читаємо та обговорюємо фентезі щочетверга.',
  currentBook: 'Володар перснів',
  format: 'hybrid',
  language: 'Українська',
  meetingsPerMonth: '4',
  nextMeeting: '2026-12-05',
}

describe('validateClub', () => {
  test('нормалізує поля й перетворює кількість зустрічей на число', () => {
    const result = validateClub({
      ...valid, name: `  ${valid.name}  `, meetingsPerMonth: ' 4 ',
    })

    expect(result.ok).toBe(true)
    expect(result.value).toEqual({ ...valid, meetingsPerMonth: 4 })
  })

  test('порожня книга зберігається як null', () => {
    const result = validateClub({ ...valid, currentBook: '   ' })
    expect(result.value.currentBook).toBeNull()
  })

  test.each([2, 61])('відхиляє назву завдовжки %i', (length) => {
    expect(validateClub({ ...valid, name: 'а'.repeat(length) }).errors.name).toBeTruthy()
  })

  test.each([3, 60])('приймає назву завдовжки %i', (length) => {
    expect(validateClub({ ...valid, name: 'а'.repeat(length) }).ok).toBe(true)
  })

  test.each([9, 401])('відхиляє опис завдовжки %i', (length) => {
    expect(validateClub({ ...valid, description: 'а'.repeat(length) }).errors.description)
      .toBeTruthy()
  })

  test.each(['', '0', '9', '1.5', 'x'])('відхиляє кількість зустрічей %j', (value) => {
    expect(validateClub({ ...valid, meetingsPerMonth: value }).errors.meetingsPerMonth)
      .toBeTruthy()
  })

  test.each(['', '2026-13-01', '2026-02-30', '05.12.2026', 'завтра'])(
    'відхиляє дату %j',
    (nextMeeting) => {
      expect(validateClub({ ...valid, nextMeeting }).errors.nextMeeting).toBeTruthy()
    },
  )

  test('відхиляє невідомий формат і мову', () => {
    const result = validateClub({ ...valid, format: 'moon', language: 'Клінгонська' })
    expect(result.errors).toHaveProperty('format')
    expect(result.errors).toHaveProperty('language')
  })

  test('не пропускає службові поля у значення', () => {
    const result = validateClub({ ...valid, ownerId: 'user-x', membersCount: 999 })
    expect(result.value).not.toHaveProperty('ownerId')
    expect(result.value).not.toHaveProperty('membersCount')
  })
})
