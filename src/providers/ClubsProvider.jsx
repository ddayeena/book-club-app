import { useCallback, useEffect, useRef, useState } from 'react'
import { ClubsContext } from '../context/ClubsContext.js'
import { clubService } from '../services/clubService.js'
import { errorMessage } from '../services/ServiceError.js'
import { isSupabaseData } from '../services/dataSource.js'
import MockClubsProvider from './MockClubsProvider.jsx'
import useAuth from '../hooks/useAuth.js'

function RemoteClubsProvider({ children }) {
  const [clubs, setClubs] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [isMutating, setIsMutating] = useState(false)
  const read = useRef(null)
  const version = useRef(0)
  const lock = useRef(false)
  const alive = useRef(false)
  const reload = useCallback(async (preserve = false, failureMessage = '') => {
    read.current?.abort()
    const controller = new AbortController()
    read.current = controller
    const ticket = ++version.current
    if (!preserve) setStatus('loading')
    setError('')
    try {
      const records = await clubService.getAll({ signal: controller.signal })
      if (controller.signal.aborted || ticket !== version.current) return
      setClubs(records); setStatus('success')
    } catch (cause) {
      if (controller.signal.aborted || ticket !== version.current) return
      setError(failureMessage || errorMessage(cause)); setStatus('error')
    }
  }, [])
  useEffect(() => {
    alive.current = true
    void Promise.resolve().then(() => { if (alive.current) void reload() })
    return () => { alive.current = false; read.current?.abort(); version.current += 1 }
  }, [reload])
  async function mutate(operation, refreshFailureMessage = '') {
    if (lock.current) return { ok: false, message: 'Дочекайтеся завершення операції.' }
    lock.current = true; setIsMutating(true)
    try {
      const club = await operation()
      if (alive.current) await reload(true, refreshFailureMessage)
      return { ok: true, club }
    } catch (cause) { return { ok: false, message: errorMessage(cause), errors: cause.errors } }
    finally { lock.current = false; if (alive.current) setIsMutating(false) }
  }
  return <ClubsContext.Provider value={{ clubs, status, error, reload, isMutating,
    createClub: (input) => mutate(() => clubService.create(input)),
    updateClub: (id, input) => mutate(() => clubService.update(id, input)),
    deleteClub: (id) => mutate(() => clubService.archive(id)),
    restoreClub: (id) => mutate(() => clubService.restore(id), 'Клуб відновлено, але не вдалося оновити дані. Повторіть завантаження.'),
  }}>{children}</ClubsContext.Provider>
}
export default function ClubsProvider({ children }) {
  const { user } = useAuth()
  return isSupabaseData
    ? <RemoteClubsProvider key={user?.id ?? 'guest'}>{children}</RemoteClubsProvider>
    : <MockClubsProvider>{children}</MockClubsProvider>
}
