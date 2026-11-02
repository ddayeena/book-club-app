import { clubFormatOptions, isOption, languageOptions } from './options.js'

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

export function validateClub(input) {
  const errors = {}
  const name = text(input.name)
  const genre = text(input.genre)
  const description = text(input.description)
  const currentBook = text(input.currentBook)
  const nextMeeting = text(input.nextMeeting)
  const meetingsText = String(input.meetingsPerMonth ?? '').trim()
  const meetingsPerMonth = Number(meetingsText)

  if (name.length < 3 || name.length > 60) {
    errors.name = 'Назва має містити від 3 до 60 символів.'
  }

  if (genre.length < 2 || genre.length > 40) {
    errors.genre = 'Жанр має містити від 2 до 40 символів.'
  }

  if (description.length < 10 || description.length > 400) {
    errors.description = 'Опис має містити від 10 до 400 символів.'
  }

  if (currentBook.length > 100) {
    errors.currentBook = 'Назва книги не може бути довшою за 100 символів.'
  }

  if (!isOption(clubFormatOptions, input.format)) {
    errors.format = 'Оберіть формат зустрічей.'
  }

  if (!isOption(languageOptions, input.language)) {
    errors.language = 'Оберіть мову спілкування.'
  }

  if (meetingsText === '') {
    errors.meetingsPerMonth = 'Вкажіть, скільки зустрічей на місяць.'
  } else if (
    !Number.isInteger(meetingsPerMonth)
    || meetingsPerMonth < 1
    || meetingsPerMonth > 8
  ) {
    errors.meetingsPerMonth = 'Кількість зустрічей має бути цілим числом від 1 до 8.'
  }

  if (nextMeeting === '') {
    errors.nextMeeting = 'Вкажіть дату найближчої зустрічі.'
  } else if (!isRealDate(nextMeeting)) {
    errors.nextMeeting = 'Вкажіть коректну дату.'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    errors: {},
    value: {
      name,
      genre,
      description,
      currentBook: currentBook === '' ? null : currentBook,
      format: input.format,
      language: input.language,
      meetingsPerMonth,
      nextMeeting,
    },
  }
}
