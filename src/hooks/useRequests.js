import { useContext } from 'react'
import { RequestsContext } from '../context/RequestsContext.js'

export default function useRequests() {
  const context = useContext(RequestsContext)
  if (context === null) {
    throw new Error('useRequests must be used within RequestsProvider')
  }
  return context
}