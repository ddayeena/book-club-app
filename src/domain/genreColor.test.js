import { expect, test } from 'vitest'
import { genreColor } from './genreColor.js'
import { initials, firstName } from './people.js'
import { clubs } from '../data/clubs.js'

test('кожен жанр початкового каталогу має власний колір', () => {
  const genres = [...new Set(clubs.map((club) => club.genre))]
  const spines = genres.map((genre) => genreColor(genre).spine)

  expect(new Set(spines).size).toBe(genres.length)
})

test('невідомий жанр завжди отримує той самий колір із палітри', () => {
  expect(genreColor('Поезія')).toEqual(genreColor('Поезія'))
  expect(genreColor('Поезія').spine).toMatch(/^#[0-9a-f]{6}$/)
})

test('ініціали й імʼя', () => {
  expect(initials('оксана мельник')).toBe('ОМ')
  expect(initials('  Тарас ')).toBe('Т')
  expect(initials('')).toBe('?')
  expect(firstName('Оксана Мельник')).toBe('Оксана')
})
