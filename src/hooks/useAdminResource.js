import { useEffect, useRef, useState } from 'react'
import useAuth from './useAuth.js'
import { errorMessage } from '../services/ServiceError.js'

export default function useAdminResource(load) {
  const { refreshAccess } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const alive = useRef(false)
  const lock = useRef(false)
  const read = useRef(null)
  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    read.current = controller
    load(controller.signal).then((records) => {
      if (!controller.signal.aborted) { setData(records); setLoading(false) }
    }).catch((cause) => {
      if (!controller.signal.aborted) {
        setData(null); setError(errorMessage(cause)); setLoading(false)
        if (cause.code === '42501') void refreshAccess()
      }
    })
    return () => { alive.current = false; controller.abort() }
  }, [load, attempt, refreshAccess])
  function refresh() {
    if (lock.current) return
    setLoading(true); setError(''); setAttempt((n) => n + 1)
  }
  async function run(operation, message) {
    if (lock.current) return false
    lock.current = true; setBusy(true); setError(''); setNotice('')
    read.current?.abort()
    try {
      await operation()
      if (!alive.current) return false
      setNotice(message); setData(null); setLoading(true); setAttempt((n) => n + 1)
      return true
    } catch (cause) {
      if (alive.current) {
        setError(errorMessage(cause))
        if (cause.code === '42501') void refreshAccess()
      }
      return false
    } finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  return { data, loading, error, notice, busy, refresh, run }
}
