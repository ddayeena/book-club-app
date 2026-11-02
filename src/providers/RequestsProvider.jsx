import { useCallback, useEffect, useRef, useState } from 'react'
import { RequestsContext } from '../context/RequestsContext.js'
import { requestService } from '../services/requestService.js'
import { errorMessage } from '../services/ServiceError.js'
import useAuth from '../hooks/useAuth.js'

export default function RequestsProvider({ children }) {
  const { user } = useAuth()
  const [requests, setRequests] = useState([])
  // Гість не має заявок: читати нічого, тому стан одразу «успішний» і порожній.
  const [status, setStatus] = useState(user ? 'loading' : 'success')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isMutating, setIsMutating] = useState(false)
  const activeRead = useRef(null)
  const readVersion = useRef(0)
  const mutationLock = useRef(false)
  const mounted = useRef(false)

  const load = useCallback(() => {
    activeRead.current?.abort()
    const controller = new AbortController()
    activeRead.current = controller
    const version = ++readVersion.current
    const isStale = () => controller.signal.aborted || version !== readVersion.current

    return requestService.getAll({ signal: controller.signal }).then(
      (records) => {
        if (isStale()) return
        setRequests(records)
        setStatus('success')
      },
      (cause) => {
        if (isStale()) return
        setError(errorMessage(cause))
        setStatus('error')
      },
    )
  }, [])

  const reload = useCallback(() => {
    if (mutationLock.current) return Promise.resolve()
    setStatus('loading')
    setError('')
    return load()
  }, [load])

  useEffect(() => {
    mounted.current = true
    if (user) void load()
    return () => {
      mounted.current = false
      activeRead.current?.abort()
      readVersion.current += 1
    }
  }, [load, user])

  async function mutate(operation, apply, message) {
    if (mutationLock.current || status !== 'success') {
      return { ok: false, message: 'Дочекайтеся завершення поточної операції.' }
    }
    mutationLock.current = true
    setIsMutating(true)
    setNotice('')
    activeRead.current?.abort()
    readVersion.current += 1

    try {
      const record = await operation()
      if (mounted.current) {
        setRequests((previous) => apply(previous, record))
        setNotice(message)
      }
      return { ok: true, record }
    } catch (cause) {
      return {
        ok: false,
        message: errorMessage(cause),
        errors: cause.errors,
        code: cause.code,
      }
    } finally {
      mutationLock.current = false
      if (mounted.current) setIsMutating(false)
    }
  }

  function createRequest(input) {
    return mutate(
      () => requestService.create(input),
      (previous, record) => [...previous.filter((entry) => entry.id !== record.id), record],
      'Заявку створено.',
    )
  }

  function updateRequest(id, input) {
    return mutate(
      () => requestService.update(id, input),
      (previous, record) => previous.map((entry) => (entry.id === id ? record : entry)),
      'Зміни заявки збережено.',
    )
  }

  function deleteRequest(id) {
    return mutate(
      () => requestService.delete(id),
      (previous) => previous.filter((entry) => entry.id !== id),
      'Заявку видалено.',
    )
  }

  return (
    <RequestsContext.Provider value={{
      requests, status, error, reload, isMutating,
      createRequest, updateRequest, deleteRequest,
      notice, dismissNotice: () => setNotice(''),
    }}>
      {children}
    </RequestsContext.Provider>
  )
}