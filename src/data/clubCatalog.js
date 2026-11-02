import { clubs as seedClubs } from './clubs.js'

// Клуби, створені користувачами, зберігаються в localStorage окремо від початкового каталогу.
export const customClubsKey = 'bookclub.clubs.v1'

function isClubRecord(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.genre === 'string'
    && typeof value.description === 'string'
    && (value.currentBook === null || typeof value.currentBook === 'string')
    && Number.isInteger(value.membersCount)
    && typeof value.format === 'string'
    && typeof value.language === 'string'
    && Number.isInteger(value.meetingsPerMonth)
    && typeof value.nextMeeting === 'string'
    && (value.ownerId === null || typeof value.ownerId === 'string')
}

export function readCustomClubs() {
  try {
    const raw = localStorage.getItem(customClubsKey)
    if (raw === null) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isClubRecord) : []
  } catch {
    return []
  }
}

export function writeCustomClubs(clubs) {
  try {
    localStorage.setItem(customClubsKey, JSON.stringify(clubs))
    return true
  } catch {
    return false
  }
}

export function listAllClubs() {
  return [...seedClubs, ...readCustomClubs()]
}
