import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import Link from '../components/navigation/ClubLink.jsx'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import { clubService } from '../services/clubService.js'
import { errorMessage } from '../services/ServiceError.js'
import LeaveClubButton from '../components/clubs/LeaveClubButton.jsx'
import useConfirmAction from '../hooks/useConfirmAction.jsx'

function Members({ clubId }) {
  const { ask, confirmation } = useConfirmAction()
  const { user } = useAuth()
  const { clubs, reload } = useClubs()
  const club = clubs.find((entry) => entry.id === clubId)
  const [members, setMembers] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [attempt, setAttempt] = useState(0)
  const alive = useRef(false)
  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    clubService.getMembers(clubId, { signal: controller.signal }).then(
      (records) => { if (!controller.signal.aborted) { setMembers(records); setStatus('success') } },
      (cause) => { if (!controller.signal.aborted) { setError(errorMessage(cause)); setStatus('error') } },
    )
    return () => { alive.current = false; controller.abort() }
  }, [clubId, attempt])
  async function remove(id) {
    if (lock.current) return false
    lock.current = true; setBusy(true); setError('')
    try {
      await clubService.removeMember(clubId, id)
      if (alive.current) {
        await reload()
      }
      return true
    } catch (cause) { if (alive.current) setError(errorMessage(cause)); return { ok: false, message: errorMessage(cause) } }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  const manage = club?.ownerId === user.id || user.role === 'admin'
  return <><PageHeading title="Учасники клубу" /><p><Link to={`/clubs/${clubId}`}>До клубу</Link></p>
    {confirmation}
    {error && !confirmation && <p role="alert">{error}</p>}
    {status === 'loading' && <p role="status">Завантаження учасників…</p>}
    {status === 'error' && <AppButton onClick={() => { setStatus('loading'); setError(''); setAttempt((n) => n + 1) }}>Повторити</AppButton>}
    {status === 'success' && <ul className="rank-list">{members.map((member) => <li key={member.user_id}>
      <span>{member.name}{member.user_id === club?.ownerId ? ' — власник' : ''}</span>
      {member.user_id === user.id
        ? <LeaveClubButton club={club && { ...club, isMember: true }} returnToClub disabled={busy} />
        : member.user_id !== club?.ownerId && manage &&
          <AppButton disabled={busy} variant="secondary" onClick={() => ask({ title: 'Виключити учасника?', description: `${member.name} втратить доступ учасника. Історія збережеться.`, action: () => remove(member.user_id) })}>Виключити</AppButton>}
    </li>)}</ul>}
  </>
}
export default function ClubMembersPage() {
  const { clubId } = useParams()
  const { user } = useAuth()
  return <Members key={clubId + user.id} clubId={clubId} />
}
