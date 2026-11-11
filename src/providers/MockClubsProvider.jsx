import { useState } from 'react'
import { ClubsContext } from '../context/ClubsContext.js'
import { clubs as seedClubs } from '../data/clubs.js'
import { readCustomClubs, writeCustomClubs } from '../data/clubCatalog.js'
import { validateClub } from '../domain/clubValidation.js'
import useAuth from '../hooks/useAuth.js'

const storageFailure = {
  ok: false,
  message: 'Не вдалося зберегти клуб у локальному сховищі.',
}

export default function MockClubsProvider({ children }) {
  const { user } = useAuth()
  const [customClubs, setCustomClubs] = useState(() => readCustomClubs())
  const clubs = [...seedClubs, ...customClubs]

  function persist(next) {
    if (!writeCustomClubs(next)) return false
    setCustomClubs(next)
    return true
  }

  function findOwned(id) {
    return customClubs.find((club) => club.id === id && club.ownerId === user?.id)
  }

  function createClub(input) {
    if (!user) return { ok: false, message: 'Увійдіть, щоб створити клуб.' }

    const validation = validateClub(input)
    if (!validation.ok) return validation

    const club = {
      ...validation.value,
      id: `club-${crypto.randomUUID()}`,
      membersCount: 1,
      ownerId: user.id,
      ownerName: user.name,
    }
    return persist([...customClubs, club]) ? { ok: true, club } : storageFailure
  }

  function updateClub(id, input) {
    const current = findOwned(id)
    if (!current) {
      return { ok: false, message: 'Редагувати клуб може лише його власник.' }
    }

    const validation = validateClub(input)
    if (!validation.ok) return validation

    const club = { ...current, ...validation.value }
    const next = customClubs.map((entry) => (entry.id === id ? club : entry))
    return persist(next) ? { ok: true, club } : storageFailure
  }

  function deleteClub(id) {
    if (!findOwned(id)) {
      return { ok: false, message: 'Видалити клуб може лише його власник.' }
    }
    return persist(customClubs.filter((entry) => entry.id !== id))
      ? { ok: true }
      : storageFailure
  }

  return (
    <ClubsContext.Provider value={{ clubs, createClub, updateClub, deleteClub }}>
      {children}
    </ClubsContext.Provider>
  )
}
