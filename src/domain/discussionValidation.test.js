import { expect, test } from 'vitest'
import { validateDiscussion } from './discussionValidation.js'
test('discussion trims inputs, optional book and rejects blank or oversized fields', () => {
  expect(validateDiscussion({ title: ' Тема ', body: ' текст ' }).value).toEqual({ title: 'Тема', body: 'текст', bookId: null })
  for (const input of [{ title: 'ab', body: 'x' }, { title: 'a'.repeat(121), body: 'x' }, { title: 'Тема', body: '\n\t ' }, { title: 'Тема', body: 'x'.repeat(10001) }]) expect(validateDiscussion(input).ok).toBe(false)
})
test('comments have independent 2000-character maximum and Unicode code-point lengths', () => {
  expect(validateDiscussion({ body: '😀'.repeat(2000) }, true).ok).toBe(true)
  expect(validateDiscussion({ body: 'x'.repeat(2001) }, true).ok).toBe(false)
  expect(validateDiscussion({}, true).ok).toBe(false)
})
test('Unicode whitespace is trimmed consistently at content boundaries', () => {
  expect(validateDiscussion({ title: '\u00a0\ufeffТема\u3000', body: '\u000b текст \u2029' }).value).toMatchObject({ title: 'Тема', body: 'текст' })
  expect(validateDiscussion({ body: '\u00a0\ufeff\u2028\u3000' }, true).ok).toBe(false)
})
