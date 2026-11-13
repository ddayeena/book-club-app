import { useContext } from 'react'
import { ClubsContext } from '../context/ClubsContext.js'

export default function useClubs() {
  const context = useContext(ClubsContext)
  if (context === null) {
    throw new Error('useClubs must be used within ClubsProvider')
  }
  return context
}
