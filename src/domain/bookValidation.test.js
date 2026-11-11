import { expect, test } from 'vitest'
import { safeCoverUrl, validateBook } from './bookValidation.js'
const draft = { title: ' Книга ', author: ' Автор ', description: '', coverUrl: '' }
test('нормалізує нову книгу без обкладинки', () => {
  expect(validateBook(draft)).toMatchObject({ ok: true, value: { title: 'Книга', author: 'Автор', description: null, coverUrl: null } })
})
test('новій книзі потрібен автор; перенесеній дозволено NULL', () => {
  expect(validateBook({ ...draft, author: '' }).ok).toBe(false)
  expect(validateBook({ ...draft, author: '' }, true)).toMatchObject({ ok: true, value: { author: null } })
})
test.each(['http://example.com/a.jpg', 'javascript:alert(1)', 'data:image/svg+xml,x', 'https://user:pass@example.com/a', 'https:example.com', 'https://'])('відхиляє небезпечний URL %s', (value) => {
  expect(safeCoverUrl(value)).toBeNull()
  expect(validateBook({ ...draft, coverUrl: value }).errors.coverUrl).toBeTruthy()
})
test('приймає валідний HTTPS URL', () => {
  expect(safeCoverUrl(' https://example.com/book.jpg ')).toBe('https://example.com/book.jpg')
})
test.each([['title', ''], ['title', 'x'.repeat(201)], ['author', 'x'.repeat(121)], ['description', 'x'.repeat(2001)]])('перевіряє межі %s', (field, value) => {
  expect(validateBook({ ...draft, [field]: value }).errors[field]).toBeTruthy()
})
