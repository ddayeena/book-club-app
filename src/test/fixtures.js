import { clubs } from '../data/clubs.js'

export const testClub = clubs.find((club) => club.id === 'club-001')

export const validInput = {
  clubId: 'club-001',
  motivation: 'Хочу читати сучасну прозу разом з іншими.',
  weeklyHours: 2,
  wantsReminders: true,
  experience: 'regular',
  participationFormat: 'online',
  contactEmail: 'reader@example.com',
}

export const savedRequest = {
  ...validInput,
  id: 'req-test-001',
  ownerId: 'user-demo',
  createdAt: '2026-10-10T10:00:00.000Z',
}
// Клуб, створений демо-користувачем (зберігається окремо від початкового каталогу).
export const ownClub = {
  id: 'club-own-1',
  name: 'Мій клуб читання',
  genre: 'Поезія',
  currentBook: null,
  membersCount: 1,
  description: 'Читаємо вірші та говоримо про них.',
  format: 'offline',
  language: 'Українська',
  meetingsPerMonth: 2,
  nextMeeting: '2026-12-01',
  ownerId: 'user-demo',
  ownerName: 'Демо Читач',
}
