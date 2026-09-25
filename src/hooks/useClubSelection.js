import { useContext } from 'react'
import { ClubSelectionContext } from '../context/ClubSelectionContext.js'

export default function useClubSelection() {
  const selection = useContext(ClubSelectionContext)

  if (selection === null) {
    throw new Error(
      'useClubSelection must be used within ClubSelectionProvider',
    )
  }

  return selection
}
