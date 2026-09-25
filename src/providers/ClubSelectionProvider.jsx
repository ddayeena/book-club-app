import { useState } from 'react'
import { ClubSelectionContext } from '../context/ClubSelectionContext.js'

export default function ClubSelectionProvider({ clubs, children }) {
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