import { describe, expect, test } from 'vitest'
import { validateRequest } from './requestValidation.js'
import { testClub, validInput } from '../test/fixtures.js'

const clubs = [testClub]

describe('validateRequest', () => {
  test('нормалізує коректні поля, не змінюючи вхід', () => {
    const input = Object.freeze({
      ...validInput,
      motivation: ` ${validInput.motivation} `,
      weeklyHours: '2',
      contactEmail: '  Reader@Example.COM ',
      id: 'injected-id',
    })

    const result = validateRequest(input, clubs)

    expect(result).toEqual({ ok: true, errors: {}, value: validInput })
    expect(result.value).not.toHaveProperty('id')
    expect(input.weeklyHours).toBe('2')
    expect(input.motivation.startsWith(' ')).toBe(true)
  })

  test.each(['', '0', '1.5', '9'])('відхиляє тривалість %j', (weeklyHours) => {
    const result = validateRequest({ ...validInput, weeklyHours }, clubs)

    expect(result.ok).toBe(false)
    expect(result.errors.weeklyHours).toBeTruthy()
  })

  test.each([1, 8])('приймає граничну тривалість %i', (weeklyHours) => {
    expect(validateRequest({ ...validInput, weeklyHours }, clubs).ok).toBe(true)
  })

  test('для понад чотирьох годин вимагає нагадування', () => {
    const result = validateRequest({
      ...validInput, weeklyHours: 5, wantsReminders: false,
    }, clubs)

    expect(result.ok).toBe(false)
    expect(result.errors.wantsReminders).toBeTruthy()
  })

  test('для рівно чотирьох годин нагадування не обов’язкові', () => {
    const result = validateRequest({
      ...validInput, weeklyHours: 4, wantsReminders: false,
    }, clubs)

    expect(result.ok).toBe(true)
  })

  test('зв’язок з нагадуваннями не показується, поки години некоректні', () => {
    const result = validateRequest({
      ...validInput, weeklyHours: 9, wantsReminders: false,
    }, clubs)

    expect(result.errors.weeklyHours).toBeTruthy()
    expect(result.errors).not.toHaveProperty('wantsReminders')
  })

  test('відхиляє невідомий клуб', () => {
    const result = validateRequest({ ...validInput, clubId: 'club-missing' }, clubs)
    expect(result.errors.clubId).toBeTruthy()
  })

  test.each([9, 501])('відхиляє мотивацію завдовжки %i', (length) => {
    const result = validateRequest({
      ...validInput, motivation: 'а'.repeat(length),
    }, clubs)
    expect(result.errors.motivation).toBeTruthy()
  })

  test.each([10, 500])('приймає мотивацію завдовжки %i', (length) => {
    const result = validateRequest({
      ...validInput, motivation: 'а'.repeat(length),
    }, clubs)
    expect(result.ok).toBe(true)
  })

  test('відхиляє невідомий рівень досвіду й формат участі', () => {
    const result = validateRequest({
      ...validInput, experience: 'expert', participationFormat: 'moon',
    }, clubs)

    expect(result.errors.experience).toBeTruthy()
    expect(result.errors.participationFormat).toBeTruthy()
  })

  test.each(['', '   '])('дозволяє порожню пошту %j', (contactEmail) => {
    const result = validateRequest({ ...validInput, contactEmail }, clubs)

    expect(result.ok).toBe(true)
    expect(result.value.contactEmail).toBe('')
  })

  test.each(['reader', 'reader@', 'reader@example', 'a b@example.com'])(
    'відхиляє некоректну пошту %j',
    (contactEmail) => {
      const result = validateRequest({ ...validInput, contactEmail }, clubs)
      expect(result.errors.contactEmail).toBeTruthy()
    },
  )

  test('відхиляє надто довгу пошту', () => {
    const contactEmail = `${'a'.repeat(95)}@e.com`
    const result = validateRequest({ ...validInput, contactEmail }, clubs)
    expect(result.errors.contactEmail).toBeTruthy()
  })
})