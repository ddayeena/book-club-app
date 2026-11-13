import { expect, test } from 'vitest'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import process from 'node:process'
import { validateMeeting, localToInstant, localDateTime, formatMeetingTime } from './meetingValidation.js'
const draft = { title: 'Читаємо разом', localTime: '2099-06-10T12:30', format: 'online', meetingUrl: 'https://example.test/room', location: '', description: '' }
test('meeting validates fields and emits an explicit UTC instant with browser timezone', () => {
  const result = validateMeeting(draft)
  expect(result.ok).toBe(true)
  expect(result.value.starts_at).toMatch(/Z$/)
  expect(localDateTime(result.value.starts_at)).toBe(draft.localTime)
  expect(result.value.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  expect(formatMeetingTime(result.value.starts_at, 'UTC')).not.toBe('—')
})
test.each([
  ['title', 'A'], ['localTime', '2020-01-01T12:00'], ['localTime', '2099-02-30T12:00'],
  ['format', 'unknown'], ['meetingUrl', 'javascript:alert(1)'], ['meetingUrl', 'https://user:secret@example.test'],
  ['meetingUrl', 'https://example.test/a b'], ['description', 'A'.repeat(2001)], ['location', 'A'.repeat(301)],
  ['meetingUrl', 'https://:'], ['meetingUrl', 'https://example.test/' + String.fromCharCode(92) + 'room'],
])('meeting rejects invalid %s: %s', (field, value) => {
  expect(validateMeeting({ ...draft, [field]: value }).errors[field]).toBeTruthy()
})
test('format rules require offline location and both hybrid fields', () => {
  expect(validateMeeting({ ...draft, format: 'offline', meetingUrl: '' }).errors.location).toBeTruthy()
  expect(validateMeeting({ ...draft, format: 'offline', location: 'Бібліотека', meetingUrl: '' }).ok).toBe(true)
  expect(validateMeeting({ ...draft, format: 'hybrid', location: 'Бібліотека', meetingUrl: '' }).errors.meetingUrl).toBeTruthy()
})
test('DST gaps and overlaps fail explicitly in a real timezone', () => {
  const moduleUrl = pathToFileURL(resolve('src/domain/meetingValidation.js')).href
  const source = `import {localToInstant} from ${JSON.stringify(moduleUrl)};
    console.log(JSON.stringify(['2026-03-08T02:30','2026-11-01T01:30','2026-03-08T03:30'].map(localToInstant)))`
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', source], { env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8' })
  expect(JSON.parse(output)).toEqual([null, null, '2026-03-08T07:30:00.000Z'])
  expect(localToInstant('not a date')).toBeNull()
})

test('an existing DST-overlap instant can retain its unambiguous stored value when editing other fields', () => {
  const moduleUrl = pathToFileURL(resolve('src/domain/meetingValidation.js')).href
  const source = `import {validateMeeting, localDateTime, localToInstant} from ${JSON.stringify(moduleUrl)};
    Date.now=()=>Date.parse('2026-01-01T00:00:00Z');
    const original={startsAt:'2026-11-01T05:30:45.123456Z',timezone:'America/New_York'};
    const draft={title:'Updated title',localTime:localDateTime(original.startsAt),format:'offline',location:'Library'};
    console.log(JSON.stringify({ambiguous:localToInstant(draft.localTime),result:validateMeeting(draft,original)}))`
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', source], { env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8' })
  expect(JSON.parse(output)).toMatchObject({ ambiguous: null, result: { ok: true, value: { starts_at: '2026-11-01T05:30:45.123456Z', timezone: 'America/New_York' } } })
})

