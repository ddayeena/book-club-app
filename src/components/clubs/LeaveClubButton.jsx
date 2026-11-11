import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import useAuth from '../../hooks/useAuth.js'
import useClubs from '../../hooks/useClubs.js'
import { clubService } from '../../services/clubService.js'
import { errorMessage } from '../../services/ServiceError.js'
import AppButton from '../ui/AppButton.jsx'

export default function LeaveClubButton({ club, returnToClub = false, disabled = false }) {
  const { user } = useAuth()
  const { reload } = useClubs()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const alive = useRef(false)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  if (!user || !club?.isMember || club.ownerId === user.id) return null

  async function leave() {
    if (lock.current || !window.confirm('Покинути клуб? Історія заявок збережеться.')) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      await clubService.removeMember(club.id, user.id)
      if (!alive.current) return
      await reload(true)
      if (alive.current && returnToClub) navigate(`/clubs/${club.id}`)
    } catch (cause) {
      if (alive.current) setError(errorMessage(cause))
    } finally {
      lock.current = false
      if (alive.current) setBusy(false)
    }
  }

  return <div>
    <AppButton variant="secondary" disabled={disabled || busy} onClick={() => void leave()}>
      {busy ? 'Вихід…' : 'Покинути клуб'}
    </AppButton>
    {error && <p role="alert">{error}</p>}
  </div>
}
