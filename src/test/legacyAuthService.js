import { ServiceError } from '../services/ServiceError.js'
import { validateLogin, validateRegistration } from '../domain/authValidation.js'

// УВАГА: це навчальна імітація серверної автентифікації. Користувачі й сесія
// зберігаються в localStorage браузера, тому це НЕ захищає справжні дані.
// У реальному застосунку реєстрацію, хешування й сесії виконує сервер.
export const usersKey = 'bookclub.users.v1'
export const sessionKey = 'bookclub.session.v1'

const iterations = 100_000

// Демонстраційний користувач: пароль demo1234 (хеш обчислено функцією hashPassword).
export const demoUser = {
  id: 'user-demo',
  name: 'Демо Читач',
  email: 'demo@bookclub.test',
  salt: '9d1f3a7c52b84e60a1c7d3e9f4b25a80',
  hash: 'ad2d7a452ea7904598748dbf4ccdc6a24b4190a2751515099a900a8e54f0de30',
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

export async function hashPassword(password, saltHex) {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new ServiceError(
      'Вхід недоступний у цьому середовищі (потрібне безпечне зʼєднання або localhost).',
      { code: 'CRYPTO' },
    )
  }
  const key = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations },
    key,
    256,
  )
  return toHex(bits)
}

function isStoredUser(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.email === 'string'
    && typeof value.salt === 'string'
    && typeof value.hash === 'string'
}

function readStoredUsers() {
  try {
    const raw = localStorage.getItem(usersKey)
    if (raw === null) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isStoredUser) : []
  } catch {
    return []
  }
}

function allUsers() {
  return [demoUser, ...readStoredUsers()]
}

function toPublic(user) {
  return { id: user.id, name: user.name, email: user.email }
}

export function getSessionUser() {
  try {
    const id = localStorage.getItem(sessionKey)
    if (!id) return null
    const user = allUsers().find((entry) => entry.id === id)
    return user ? toPublic(user) : null
  } catch {
    return null
  }
}

export function currentUserId() {
  return getSessionUser()?.id ?? null
}

function startSession(id) {
  try {
    localStorage.setItem(sessionKey, id)
  } catch {
    throw new ServiceError('Не вдалося зберегти сеанс входу.', { code: 'STORAGE_WRITE' })
  }
}

export async function register(input) {
  const validation = validateRegistration(input)
  if (!validation.ok) {
    throw new ServiceError('Перевірте поля реєстрації.', {
      code: 'VALIDATION',
      errors: validation.errors,
    })
  }

  const { name, email, password } = validation.value
  if (allUsers().some((user) => user.email === email)) {
    throw new ServiceError('Користувач із такою поштою вже існує.', {
      code: 'VALIDATION',
      errors: { email: 'Користувач із такою поштою вже існує.' },
    })
  }

  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)))
  const user = {
    id: `user-${crypto.randomUUID()}`,
    name,
    email,
    salt,
    hash: await hashPassword(password, salt),
  }

  try {
    localStorage.setItem(usersKey, JSON.stringify([...readStoredUsers(), user]))
  } catch {
    throw new ServiceError('Не вдалося зберегти обліковий запис.', { code: 'STORAGE_WRITE' })
  }

  startSession(user.id)
  return toPublic(user)
}

export async function login(input) {
  const validation = validateLogin(input)
  if (!validation.ok) {
    throw new ServiceError('Перевірте поля входу.', {
      code: 'VALIDATION',
      errors: validation.errors,
    })
  }

  const { email, password } = validation.value
  const user = allUsers().find((entry) => entry.email === email)
  const hash = user ? await hashPassword(password, user.salt) : null

  if (!user || hash !== user.hash) {
    throw new ServiceError('Невірна пошта або пароль.', { code: 'INVALID_CREDENTIALS' })
  }

  startSession(user.id)
  return toPublic(user)
}

export function logout() {
  try {
    localStorage.removeItem(sessionKey)
  } catch {
    // Якщо сховище недоступне, сеансу й так немає.
  }
}

// Test-only adapter: old scenarios exercise forms without contacting Supabase.
export function setActiveUser() {}
export async function getSession() { return getSessionUser() }
export function subscribe() { return { unsubscribe() {} } }
