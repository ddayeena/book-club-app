import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import MeetingForm from '../components/meetings/MeetingForm.jsx'
import { meetingService } from '../services/meetingService.js'
import { errorMessage } from '../services/ServiceError.js'
import NotFoundPage from './NotFoundPage.jsx'

function Editor({ club, meetingId }) {
  const navigate = useNavigate(), { reload } = useClubs(), { refreshAccess } = useAuth()
  const [meeting, setMeeting] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const alive = useRef(false), lock = useRef(false)
  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    if (meetingId) meetingService.get(meetingId, { signal: controller.signal }).then((m) => {
      if (m.clubId !== club.id) throw new Error('Зустріч не належить цьому клубу.')
      if (!controller.signal.aborted) setMeeting(m)
    }).catch((cause) => { if (!controller.signal.aborted) setError(errorMessage(cause)) })
    return () => { alive.current = false; controller.abort() }
  }, [club.id, meetingId, attempt])
  async function save(draft) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const result = await meetingService.save(club.id, draft, meeting)
      if (!alive.current) return
      // Save success must not be reported as failure if catalog refresh fails.
      void reload(true).catch(() => {})
      navigate(`/clubs/${club.id}/meetings/${result.id}`, { replace: true })
    } catch (cause) { if (alive.current) { setError(errorMessage(cause)); if (cause.code === '42501') void refreshAccess() } }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  function refresh() { if (!lock.current) { setError(''); setMeeting(null); setAttempt((v) => v + 1) } }
  return <div className="meetings-page"><p className="breadcrumb"><Link to={`/clubs/${club.id}/meetings`}>Зустрічі клубу</Link> / {meetingId ? 'Редагування' : 'Створення'}</p>
    <PageHeading title={meetingId ? 'Редагування зустрічі' : 'Нова зустріч'} />
    {error && <><p role="alert" className="form-alert">{error}</p>{meetingId && <AppButton disabled={busy} onClick={refresh}>Перечитати актуальні дані</AppButton>}</>}
    {meetingId && !meeting && !error && <p role="status">Завантаження зустрічі…</p>}
    {(!meetingId || meeting?.canManage) && <MeetingForm key={meeting?.updatedAt ?? 'new'} meeting={meeting} busy={busy} onSave={save} />}
    {meeting && !meeting.canManage && <p className="flash">Ця зустріч доступна лише для перегляду.</p>}
  </div>
}
export default function MeetingEditorPage() {
  const { clubId, meetingId } = useParams(), { clubs } = useClubs(), { user } = useAuth()
  const club = clubs.find((c) => c.id === clubId)
  if (!club || !user) return <NotFoundPage title="Клуб не знайдено" />
  if (club.ownerId !== user.id || club.archivedAt) return <NotFoundPage title="Керувати зустрічами може лише власник активного клубу" />
  return <Editor key={clubId + (meetingId ?? 'new') + user.id} club={club} meetingId={meetingId} />
}

