import { describe, expect, test } from 'vitest'
import { validateLogin, validateRegistration } from './authValidation.js'

const valid = { name: 'Оксана Мельник', email: 'oksana@example.com', password: 'secret123' }

describe('validateRegistration', () => {
  test('нормалізує імʼя й пошту', () => {
    const result = validateRegistration({
      name: '  Оксана Мельник ', email: '  Oksana@Example.COM ', password: 'secret123',
    })

    expect(result).toEqual({ ok: true, errors: {}, value: valid })
  })

  test.each([
    ['короткий', 'abc1'],
    ['без цифри', 'тільки-літери'],
    ['без літери', '12345678'],
  ])('відхиляє пароль: %s', (_label, password) => {
    const result = validateRegistration({ ...valid, password })
    expect(result.errors.password).toBeTruthy()
  })

  test('приймає пароль із літер і цифр', () => {
    expect(validateRegistration({ ...valid, password: 'пароль2026' }).ok).toBe(true)
  })

  test.each(['', 'a@b', 'не пошта', 'a b@example.com'])('відхиляє пошту %j', (email) => {
    expect(validateRegistration({ ...valid, email }).errors.email).toBeTruthy()
  })

  test.each(['', 'О'])('відхиляє імʼя %j', (name) => {
    expect(validateRegistration({ ...valid, name }).errors.name).toBeTruthy()
  })
})

describe('validateLogin', () => {
  test('не вимагає складності пароля при вході', () => {
    expect(validateLogin({ email: 'a@b.co', password: '1' }).ok).toBe(true)
  })

  test('відхиляє порожні поля', () => {
    const result = validateLogin({ email: '', password: '' })
    expect(result.errors).toHaveProperty('email')
    expect(result.errors).toHaveProperty('password')
  })
})
