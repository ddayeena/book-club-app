import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import Link from '../components/navigation/ClubLink.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import AdminConfirmation from '../components/admin/AdminConfirmation.jsx'
import { meetingService } from '../services/meetingService.js'
import { formatMeetingTime, meetingStatuses } from '../domain/meetingValidation.js'
import { clubFormatOptions, optionLabel } from '../domain/options.js'
import { errorMessage } from '../services/ServiceError.js'
import NotFoundPage from './NotFoundPage.jsx'

function Details({ club, meetingId }) {
  const { user, refreshAccess } = useAuth(), { reload } = useClubs()
  const [meeting, setMeeting] = useState(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false), [notice, setNotice] = useState('')
  const [expired, setExpired] = useState(false)
  const alive = useRef(false), lock = useRef(false), trigger = useRef(null), heading = useRef(null)
  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    meetingService.get(meetingId, { signal: controller.signal }).then((m) => {
      if (m.clubId !== club.id) throw new Error('Зустріч не належить цьому клубу.')
      if (!controller.signal.aborted) { setMeeting(m); setExpired(false) }
    }).catch((cause) => { if (!controller.signal.aborted) setError(errorMessage(cause)) })
    return () => { alive.current = false; controller.abort() }
  }, [meetingId, club.id, attempt])
  useEffect(() => {
    if (!meeting?.canManage) return
    const delay = new Date(meeting.startsAt) - new Date(meeting.serverNow)
    // Long meetings are checked again before the maximum browser timer interval.
    const started = performance.now()
    let timer
    function check() {
      const remaining = delay - (performance.now() - started)
      if (remaining <= 0) setExpired(true)
      else timer = setTimeout(check, Math.min(remaining, 2147483647))
    }
    timer = setTimeout(check, Math.min(Math.max(0, delay), 2147483647))
    return () => clearTimeout(timer)
  }, [meeting])
  const canManage = meeting?.canManage && user.id === club.ownerId && !club.archivedAt && !expired && !error
  function refresh() { if (!lock.current) { setMeeting(null); setError(''); setConfirm(false); setAttempt((n) => n + 1) } }
  function dismiss() { if (!lock.current) { setConfirm(false); trigger.current?.querySelector('button')?.focus() } }
  async function cancel() {
    if (lock.current || !canManage) return
    lock.current = true; setBusy(true); setError('')
    try {
      await meetingService.cancel(meeting)
      if (!alive.current) return
      setConfirm(false); setNotice('Зустріч скасовано. Запис збережено в історії.'); heading.current?.focus()
      try {
        const updated = await meetingService.get(meetingId)
        if (alive.current) setMeeting(updated)
        await reload(true)
      } catch { if (alive.current) setError('Скасування збережено. Оновіть дані зустрічі.') }
    } catch (cause) { if (alive.current) { setError(errorMessage(cause)); if (cause.code === '42501') void refreshAccess() } }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  return <div className="meetings-page"><p className="breadcrumb"><Link to={`/clubs/${club.id}/meetings`}>Зустрічі клубу</Link> / Деталі</p>
    <div tabIndex={-1} ref={heading}><PageHeading title={meeting?.title ?? 'Деталі зустрічі'} /></div>
    {notice && <p role="status" className="flash">{notice}</p>}
    {error && !confirm && <p role="alert" className="form-alert">{error}</p>}
    {!meeting && !error && <p role="status">Завантаження зустрічі…</p>}
    <AppButton variant="secondary" disabled={busy} onClick={refresh}>Оновити дані</AppButton>
    {meeting && <section className="meeting-card" aria-label="Інформація про зустріч">
      <span className="meta-tag">{expired && meeting.status === 'upcoming' ? meetingStatuses.past : meetingStatuses[meeting.status]}</span>
      <p><time dateTime={meeting.startsAt}>{formatMeetingTime(meeting.startsAt)}</time> · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
      <p className="field-hint">У часовому поясі організатора: {formatMeetingTime(meeting.startsAt, meeting.timezone)} · {meeting.timezone}</p>
      <p>{optionLabel(clubFormatOptions, meeting.format)}</p>
      {meeting.location && <p>Місце: {meeting.location}</p>}
      {meeting.meetingUrl && <p><a href={meeting.meetingUrl} target="_blank" rel="noopener noreferrer">Відкрити онлайн-зустріч (нова вкладка)</a></p>}
      {meeting.description && <p className="meeting-description">{meeting.description}</p>}
      {meeting.cancelledAt && <p className="flash">Зустріч скасовано{meeting.cancelReason === 'club_archived' ? ' через архівування клубу' : ' власником'}.</p>}
      {club.archivedAt && <p className="field-hint">Архів клубу: лише перегляд.</p>}
      {canManage && <div className="form-actions"><Link className="link-button link-button-secondary" to={`/clubs/${club.id}/meetings/${meeting.id}/edit`}>Редагувати зустріч</Link>
        <span ref={trigger}><AppButton variant="danger" disabled={busy} onClick={() => setConfirm(true)}>Скасувати зустріч</AppButton></span></div>}
      {confirm && <AdminConfirmation title="Скасувати зустріч?" busy={busy} error={error} onConfirm={cancel} onCancel={dismiss}>
        <p>Зустріч залишиться в історії. Відновити її неможливо.</p></AdminConfirmation>}
    </section>}
  </div>
}
export default function MeetingDetailsPage() {
  const { clubId, meetingId } = useParams(), { clubs } = useClubs(), { user } = useAuth()
  const club = clubs.find((c) => c.id === clubId)
  if (!club || !user) return <NotFoundPage title="Клуб не знайдено" />
  if (!(club.ownerId === user.id || club.isMember || user.role === 'admin')) return <NotFoundPage title="Зустрічі доступні лише учасникам клубу" />
  return <Details key={clubId + meetingId + user.id} club={club} meetingId={meetingId} />
}

