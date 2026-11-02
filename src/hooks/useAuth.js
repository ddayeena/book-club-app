import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext.js'

export default function useAuth() {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
