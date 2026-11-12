import { useCallback, useEffect, useRef, useState } from 'react'
import { NotificationsContext } from '../context/NotificationsContext.js'
import useAuth from '../hooks/useAuth.js'
import { notificationService } from '../services/notificationService.js'

function Notifications({ userId, children }) {
  const [count, setCount] = useState(null)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const version = useRef(0), read = useRef(null), alive = useRef(false)
  const pending = useRef(false)
  const refresh = useCallback(async (force = false) => {
    if (!userId || !alive.current) return
    if (pending.current && !force) return
    pending.current = true
    read.current?.abort()
    const controller = new AbortController(), ticket = ++version.current
    read.current = controller
    try {
      const total = await notificationService.count({ signal: controller.signal })
      if (alive.current && !controller.signal.aborted && ticket === version.current) { setCount(total); setError(false) }
    } catch {
      if (alive.current && !controller.signal.aborted && ticket === version.current) { setCount(null); setError(true) }
    } finally { if (ticket === version.current) pending.current = false }
  }, [userId])
  const invalidate = useCallback(async () => {
    if (!alive.current) return
    setRevision((n) => n + 1)
    await refresh(true)
  }, [refresh])
  useEffect(() => {
    alive.current = true
    void Promise.resolve().then(() => { if (alive.current) void refresh() })
    const visible = () => { if (document.visibilityState !== 'hidden') void refresh() }
    const timer = userId ? setInterval(visible, 60000) : null
    window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible)
    return () => {
      alive.current = false; version.current += 1; pending.current = false; read.current?.abort(); clearInterval(timer)
      window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible)
    }
  }, [userId, refresh])
  return <NotificationsContext.Provider value={{ count, error, refresh, invalidate, revision }}>{children}</NotificationsContext.Provider>
}
export default function NotificationsProvider({ children }) {
  const { user } = useAuth()
  return <Notifications key={user?.id ?? 'guest'} userId={user?.id ?? null}>{children}</Notifications>
}
