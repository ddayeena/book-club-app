import { useState } from 'react'
import { ClubSelectionContext } from '../context/ClubSelectionContext.js'
import useClubs from '../hooks/useClubs.js'

export default function ClubSelectionProvider({ children }) {
  const { clubs } = useClubs()
  const [selectedId, setSelectedId] = useState(null)
  const selectedClub = clubs.find((club) => club.id === selectedId)

  function selectClub(id) {
    if (clubs.some((club) => club.id === id)) {
      setSelectedId(id)
    }
  }

  function clearSelection() {
    setSelectedId(null)
  }

  const value = {
    selectedId,
    selectedClub,
    selectClub,
    clearSelection,
  }

  return (
    <ClubSelectionContext.Provider value={value}>
      {children}
    </ClubSelectionContext.Provider>
  )
}
