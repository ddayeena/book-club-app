import { expect, test } from 'vitest'
import { ownsAvatar, validateAvatar, validateProfile } from './profileValidation.js'
test('profile trims valid names and rejects short/long names or invalid reminder values', () => {
  expect(validateProfile({ name: ' Читач ', remindersEnabled: true })).toMatchObject({ ok: true, value: { name: 'Читач', remindersEnabled: true } })
  for (const name of [' ', 'A', 'A'.repeat(41)]) expect(validateProfile({ name, remindersEnabled: false }).ok).toBe(false)
  expect(validateProfile({ name: 'Читач', remindersEnabled: 'true' }).ok).toBe(false)
})
test('avatar path rejects other accounts, arbitrary URLs and traversal', () => {
  const file = '00000000-0000-4000-8000-000000000001.png'
  expect(ownsAvatar('a/' + file, 'a')).toBe(true)
  for (const path of ['b/' + file, 'a/../b/' + file, 'https://example.test/x.png', 'a/x.svg', null]) expect(ownsAvatar(path, 'a')).toBe(false)
})
test('file validation enforces size, MIME and image signatures', async () => {
  const png = new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'a.png', { type: 'image/png' })
  expect(await validateAvatar(png)).toBe('')
  expect(await validateAvatar(new File(['fake'], 'x.png', { type: 'image/png' }))).toContain('Вміст')
  expect(await validateAvatar(new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }))).toContain('JPEG')
  expect(await validateAvatar(new File([new Uint8Array(1048577)], 'x.jpg', { type: 'image/jpeg' }))).toContain('1 MB')
})
