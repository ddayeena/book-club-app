import { clubs } from '../data/clubs.js'
import { validateRequest } from '../domain/requestValidation.js'
import { ServiceError } from './ServiceError.js'

export function toRequestInput(input) {
  const result = validateRequest(input, clubs)
  if (!result.ok) {
    throw new ServiceError('Перевірте поля заявки.', {
      code: 'VALIDATION',
      errors: result.errors,
    })
  }
  return result.value
}

export function toRequest(value) {
  const valid = value !== null
    && typeof value === 'object'
    && typeof value.id === 'string'
    && value.id.length > 0
    && typeof value.clubId === 'string'
    && typeof value.motivation === 'string'
    && Number.isInteger(value.weeklyHours)
    && typeof value.wantsReminders === 'boolean'

  if (!valid) {
    throw new ServiceError('Джерело повернуло некоректний запис заявки.', {
      code: 'BAD_DATA',
    })
  }

  return {
    id: value.id,
    clubId: value.clubId,
    motivation: value.motivation,
    weeklyHours: value.weeklyHours,
    wantsReminders: value.wantsReminders,
  }
}

export function toRequestList(value) {
  if (!Array.isArray(value)) {
    throw new ServiceError('Джерело повернуло некоректний список.', {
      code: 'BAD_DATA',
    })
  }
  const records = value.map(toRequest)
  if (new Set(records.map((record) => record.id)).size !== records.length) {
    throw new ServiceError('Джерело повернуло повторні ідентифікатори.', {
      code: 'BAD_DATA',
    })
  }
  return records
}