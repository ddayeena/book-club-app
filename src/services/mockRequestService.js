import { requests as initialRequests } from '../data/requests.js'
import { ServiceError } from './ServiceError.js'
import { toRequestInput, toRequestList } from './requestContract.js'
import { currentUserId } from './authService.js'

// v3: кожна заявка має власника (ownerId). Старі дані (v1, v2) не читаються.
export const storageKey = 'bookclub.requests.v3'
const failures = new Set()

export function failNextMockRequest(operation) {
  failures.add(operation)
}

function pause(signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, 600)

    function abort() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', abort, { once: true })
  })
}

async function before(operation, signal) {
  const actor = requireUser()
  await pause(signal)
  if (currentUserId() !== actor) {
    throw new ServiceError('Сеанс змінився. Повторіть дію.', { code: 'UNAUTHORIZED' })
  }
  if (failures.delete(operation)) {
    throw new ServiceError('Навчальна відмова сервісу. Повторіть дію.', {
      code: 'MOCK_FAILURE',
    })
  }
}

function read() {
  try {
    const raw = localStorage.getItem(storageKey)
    return toRequestList(raw === null ? initialRequests : JSON.parse(raw))
  } catch (error) {
    if (error instanceof ServiceError) throw error
    throw new ServiceError('Не вдалося прочитати локальні дані.', {
      code: 'STORAGE_READ',
    })
  }
}

function write(records) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(records))
  } catch {
    throw new ServiceError('Не вдалося зберегти локальні дані.', {
      code: 'STORAGE_WRITE',
    })
  }
}

// Як і справжній сервер, імітація визначає користувача за сеансом, а не за полями форми.
function requireUser() {
  const id = currentUserId()
  if (!id) {
    throw new ServiceError('Увійдіть, щоб працювати із заявками.', { code: 'UNAUTHORIZED' })
  }
  return id
}

// Чужа заявка для користувача виглядає як відсутня: наявність запису не розкривається.
function findOwned(records, id, userId) {
  const record = records.find((entry) => entry.id === id && entry.ownerId === userId)
  if (!record) throw new ServiceError('Заявку не знайдено.', { code: 'NOT_FOUND' })
  return record
}

export const mockRequestService = {
  async getAll({ signal } = {}) {
    await before('getAll', signal)
    const userId = requireUser()
    return read().filter((record) => record.ownerId === userId)
  },

  async getById(id, { signal } = {}) {
    await before('getById', signal)
    return findOwned(read(), id, requireUser())
  },

  async create(input) {
    const value = toRequestInput(input)
    await before('create')
    const userId = requireUser()
    const records = read()
    const record = {
      ...value,
      id: `req-${crypto.randomUUID()}`,
      ownerId: userId,
      createdAt: new Date().toISOString(),
    }
    write([...records, record])
    return { ...record }
  },

  async update(id, input) {
    const value = toRequestInput(input)
    await before('update')
    const userId = requireUser()
    const records = read()
    const current = findOwned(records, id, userId)
    const record = {
      ...value,
      id,
      ownerId: current.ownerId,
      createdAt: current.createdAt,
    }
    write(records.map((entry) => (entry.id === id ? record : entry)))
    return { ...record }
  },

  async delete(id) {
    await before('delete')
    const userId = requireUser()
    const records = read()
    findOwned(records, id, userId)
    write(records.filter((entry) => entry.id !== id))
  },
}
