import { useCallback, useState } from 'react'
import { AuthContext } from '../context/AuthContext.js'
import * as authService from '../services/authService.js'
import { errorMessage } from '../services/ServiceError.js'

export default function AuthProvider({ children }) {
  // Сеанс відновлюється синхронно, тому після оновлення сторінки немає «блимання».
  const [user, setUser] = useState(() => authService.getSessionUser())

  async function run(operation) {
    try {
      const nextUser = await operation()
      setUser(nextUser)
      return { ok: true, user: nextUser }
    } catch (cause) {
      return { ok: false, message: errorMessage(cause), errors: cause.errors }
    }
  }

  function login(credentials) {
    return run(() => authService.login(credentials))
  }

  function register(details) {
    return run(() => authService.register(details))
  }

  const logout = useCallback(() => {
    authService.logout()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
