import { experienceOptions, isOption, participationOptions } from './options.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateRequest(input, clubs) {
  const errors = {}
  const motivation = typeof input.motivation === 'string'
    ? input.motivation.trim()
    : ''
  const hoursText = String(input.weeklyHours ?? '').trim()
  const weeklyHours = Number(hoursText)
  const rawEmail = input.contactEmail ?? ''
  const contactEmail = typeof rawEmail === 'string'
    ? rawEmail.trim().toLowerCase()
    : ''

  if (!clubs.some((club) => club.id === input.clubId)) {
    errors.clubId = 'Виберіть наявний клуб з каталогу.'
  }

  if (motivation.length === 0) {
    errors.motivation = 'Укажіть, чому хочете приєднатися.'
  } else if (motivation.length < 10 || motivation.length > 500) {
    errors.motivation = 'Мотивація має містити від 10 до 500 символів без крайніх пробілів.'
  }

  if (hoursText === '') {
    errors.weeklyHours = 'Укажіть, скільки годин на тиждень готові приділяти.'
  } else if (
    !Number.isInteger(weeklyHours)
    || weeklyHours < 1
    || weeklyHours > 8
  ) {
    errors.weeklyHours = 'Тижневе навантаження має бути цілим числом від 1 до 8.'
  }

  if (!isOption(experienceOptions, input.experience)) {
    errors.experience = 'Оберіть рівень досвіду читання.'
  }

  if (!isOption(participationOptions, input.participationFormat)) {
    errors.participationFormat = 'Оберіть бажаний формат участі.'
  }

  if (
    typeof rawEmail !== 'string'
    || (contactEmail !== '' && (contactEmail.length > 100 || !emailPattern.test(contactEmail)))
  ) {
    errors.contactEmail = 'Вкажіть коректну адресу пошти або залиште поле порожнім.'
  }

  if (typeof input.wantsReminders !== 'boolean') {
    errors.wantsReminders = 'Ознака нагадувань має бути логічним значенням.'
  } else if (!errors.weeklyHours && weeklyHours > 4 && !input.wantsReminders) {
    errors.wantsReminders = 'При навантаженні понад 4 години на тиждень увімкніть нагадування про зустрічі.'
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    errors: {},
    value: {
      clubId: input.clubId,
      motivation,
      weeklyHours,
      wantsReminders: input.wantsReminders,
      experience: input.experience,
      participationFormat: input.participationFormat,
      contactEmail,
    },
  }
}