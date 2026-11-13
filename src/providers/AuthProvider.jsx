import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthContext } from '../context/AuthContext.js'
import * as authService from '../services/authService.js'
import { errorMessage } from '../services/ServiceError.js'

export default function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, status: 'loading', error: '' })
  const version = useRef(0)
  const alive = useRef(false)
  const restore = useCallback(async (readSession, preserve = false) => {
    if (!alive.current) return
    const ticket = ++version.current
    if (!preserve) {
      authService.setActiveUser(null)
      setState({ user: null, status: 'loading', error: '' })
    }
    try {
      const session = await readSession()
      const user = await authService.getSessionUser(session)
      if (!alive.current || ticket !== version.current) return
      authService.setActiveUser(user)
      setState({ user, status: 'ready', error: '' })
    } catch (cause) {
      if (alive.current && ticket === version.current) {
        authService.setActiveUser(null)
        setState({ user: null, status: 'error', error: errorMessage(cause) })
      }
    }
  }, [])
  const retry = useCallback(() => restore(authService.getSession), [restore])
  const refreshAccess = useCallback(() => restore(authService.getSession, true), [restore])
  useEffect(() => {
    alive.current = true
    let subscription
    let timer
    let cancelled = false
    async function initialize() {
      await Promise.resolve()
      if (cancelled) return
      try {
        subscription = authService.subscribe((session) => {
          version.current += 1
          const preserve = Boolean(session) && session.user.id === authService.currentUserId()
          if (!preserve) authService.setActiveUser(null)
          clearTimeout(timer)
          if (!session) {
            setState({ user: null, status: 'ready', error: '' })
            return
          }
          if (!preserve) setState({ user: null, status: 'loading', error: '' })
          // Run database queries outside the synchronous Auth event callback.
          timer = setTimeout(() => void restore(() => session, preserve), 0)
        })
        void retry()
      } catch (cause) {
        setState({ user: null, status: 'error', error: errorMessage(cause) })
      }
    }
    void initialize()
    return () => {
      cancelled = true
      alive.current = false
      version.current += 1
      clearTimeout(timer)
      subscription?.unsubscribe()
      authService.setActiveUser(null)
    }
  }, [restore, retry])
  async function run(operation) {
    try {
      const session = await operation()
      if (session) await restore(() => session)
      return { ok: true, confirmationRequired: !session }
    } catch (cause) {
      return { ok: false, message: errorMessage(cause), errors: cause.errors }
    }
  }
  const logout = useCallback(async () => {
    try {
      await authService.logout()
      version.current += 1
      authService.setActiveUser(null)
      if (alive.current) setState({ user: null, status: 'ready', error: '' })
      return { ok: true }
    } catch (cause) { return { ok: false, message: errorMessage(cause) } }
  }, [])
  return (
    <AuthContext.Provider value={{ ...state, retry, refreshAccess, login: (input) => run(() => authService.login(input)), register: (input) => run(() => authService.register(input)), logout }}>
      {children}
    </AuthContext.Provider>
  )
}
