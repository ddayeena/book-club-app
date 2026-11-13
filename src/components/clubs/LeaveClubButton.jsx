import { useEffect, useRef, useState } from 'react'
import useNavigate from '../../hooks/useClubNavigate.js'
import useAuth from '../../hooks/useAuth.js'
import useClubs from '../../hooks/useClubs.js'
import { clubService } from '../../services/clubService.js'
import { errorMessage } from '../../services/ServiceError.js'
import AppButton from '../ui/AppButton.jsx'
import useConfirmAction from '../../hooks/useConfirmAction.jsx'

export default function LeaveClubButton({ club, returnToClub = false, disabled = false }) {
  const { user } = useAuth()
  const { reload } = useClubs()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const alive = useRef(false)
  const { ask, confirmation } = useConfirmAction()
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  if (!user || !club?.isMember || club.ownerId === user.id) return null

  async function leave() {
    if (lock.current) return { ok: false, message: 'Дочекайтеся завершення операції.' }
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await clubService.removeMember(club.id, user.id)
      if (!alive.current) return
      await reload(true)
      if (alive.current && returnToClub) navigate(`/clubs/${club.id}`)
      return { ok: true }
    } catch (cause) {
      if (alive.current) setError(errorMessage(cause))
      return { ok: false, message: errorMessage(cause) }
    } finally {
      lock.current = false
      if (alive.current) setBusy(false)
    }
  }

  return <div>
    <AppButton variant="secondary" disabled={disabled || busy} onClick={() => ask({ title: 'Покинути клуб?', description: 'Ви втратите доступ учасника. Історія заявок збережеться.', action: leave })}>
      {busy ? 'Вихід…' : 'Покинути клуб'}
    </AppButton>
    {error && !confirmation && <p role="alert">{error}</p>}
    {confirmation}
  </div>
}
