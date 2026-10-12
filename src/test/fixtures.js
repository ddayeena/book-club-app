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
  createdAt: '2026-10-10T10:00:00.000Z',
}