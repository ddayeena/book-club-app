export class ServiceError extends Error {
  constructor(message, { code = 'UNKNOWN', status, errors } = {}) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.status = status
    this.errors = errors
  }
}

export function errorMessage(error) {
  return error instanceof ServiceError
    ? error.message
    : 'Не вдалося виконати операцію. Спробуйте ще раз.'
}