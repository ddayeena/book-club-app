import { demoUser, sessionKey, usersKey } from './legacyAuthService.js'

export const otherUser = {
  id: 'user-other',
  name: 'Інша Читачка',
  email: 'other@example.com',
  salt: '00',
  hash: '00',
}

export function signInDemo() {
  localStorage.setItem(sessionKey, demoUser.id)
}

export function signInOther() {
  localStorage.setItem(usersKey, JSON.stringify([otherUser]))
  localStorage.setItem(sessionKey, otherUser.id)
}

export function signOut() {
  localStorage.removeItem(sessionKey)
}
