import { languageOptions } from './options.js'

const languageCodes = { 'Українська': 'UA', 'Англійська': 'EN', 'Українська та англійська': 'UA+EN' }
export const catalogLanguageOptions = languageOptions.map((option) => ({ value: languageCodes[option.value], label: `${option.label} (${languageCodes[option.value]})` }))
export function normalizeLanguage(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return languageCodes[text] ?? catalogLanguageOptions.find((option) => option.value === text.toUpperCase())?.value ?? null
}
export const memberRangeOptions = [
  { value: 'up-to-5', label: 'До 5 учасників', min: 0, max: 5 },
  { value: '6-10', label: '6–10', min: 6, max: 10 },
  { value: '11-20', label: '11–20', min: 11, max: 20 },
  { value: 'over-20', label: 'Понад 20', min: 21, max: Infinity },
]
export function memberCount(value) { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null }
export function normalizeGenre(value) { return typeof value === 'string' ? value.trim().toLocaleLowerCase('uk') : '' }
export function catalogGenres(clubs) {
  const names = clubs.map((club) => typeof club.genre === 'string' ? club.genre.trim() : '').filter(Boolean).sort((a, b) => a.localeCompare(b, 'uk'))
  const unique = new Map()
  for (const name of names) if (!unique.has(normalizeGenre(name))) unique.set(normalizeGenre(name), name[0].toLocaleUpperCase('uk') + name.slice(1))
  return [...unique.values()].sort((a, b) => a.localeCompare(b, 'uk'))
}
export function meetingInstant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return NaN
  const date = value.slice(0, 10), midnight = Date.parse(`${date}T00:00:00Z`)
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== date) return NaN
  return Date.parse(value)
}
