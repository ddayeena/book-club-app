import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import PollStatus from '../components/polls/PollStatus.jsx'
import PollOptions from '../components/polls/PollOptions.jsx'
import PollResults from '../components/polls/PollResults.jsx'
import PollFinalization from '../components/polls/PollFinalization.jsx'
import { pollService } from '../services/pollService.js'
import { errorMessage, ServiceError } from '../services/ServiceError.js'
import NotFoundPage from './NotFoundPage.jsx'

function Poll({ club, pollId }) {
  const { reload } = useClubs()
  const [poll, setPoll] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [expired, setExpired] = useState(false)
  const lock = useRef(false)
  const alive = useRef(false)
  const read = useRef(null)
  const cancelPanel = useRef(null)
  const cancelTrigger = useRef(null)
  const check = useCallback((record) => {
    if (record.clubId !== club.id) throw new ServiceError('Голосування не належить цьому клубу.', { code: 'NOT_FOUND' })
    return record
  }, [club.id])
  useEffect(() => {
    if (confirmCancel) cancelPanel.current?.querySelectorAll('button')[1]?.focus()
  }, [confirmCancel])
  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    read.current = controller
    pollService.get(pollId, { signal: controller.signal }).then((record) => {
      if (!controller.signal.aborted) { setPoll(check(record)); setExpired(false); setLoading(false) }
    }).catch((cause) => { if (!controller.signal.aborted) { setError(errorMessage(cause)); setLoading(false) } })
    return () => { alive.current = false; controller.abort() }
  }, [pollId, attempt, check])
  const deadline = useCallback(() => {
    setExpired(true)
    if (!lock.current) { setLoading(true); setAttempt((v) => v + 1) }
  }, [])
  function refresh() {
    if (lock.current) return
    setError(''); setLoading(true); setAttempt((v) => v + 1)
  }
  async function run(operation, message) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    read.current?.abort()
    try {
      await operation()
      if (!alive.current) return
      setNotice(message); setConfirmCancel(false)
      try {
        const [record] = await Promise.all([pollService.get(pollId), reload(true)])
        if (alive.current) { setPoll(check(record)); setExpired(false) }
      } catch { if (alive.current) { setExpired(true); setError('Зміну збережено. Оновіть голосування, щоб побачити актуальні дані.') } }
    } catch (cause) { if (alive.current) setError(errorMessage(cause)) }
    finally { lock.current = false; if (alive.current) { setBusy(false); setLoading(false) } }
  }
  const actionable = !loading && !busy && !error && !club.archivedAt
  function dismissCancellation() {
    if (busy) return
    setConfirmCancel(false)
    requestAnimationFrame(() => cancelTrigger.current?.querySelector('button')?.focus())
  }
  return <>
    <p className="breadcrumb"><Link to={`/clubs/${club.id}/polls`}>Голосування клубу</Link> / Деталі</p>
    <PageHeading title={poll?.title ?? 'Голосування за книгу'} />
    {loading && <p role="status">Завантаження голосування…</p>}
    {notice && <p role="status" className="flash">{notice}</p>}
    {error && <p role="alert" className="form-alert">{error}</p>}
    <div className="page-toolbar"><AppButton variant="secondary" disabled={busy} onClick={refresh}>Оновити голосування</AppButton>
      <Link to={`/clubs/${club.id}/books`} className="link-button link-button-secondary">Книжкова полиця</Link></div>
    {club.archivedAt && <p className="flash">Архів клубу: лише перегляд історії.</p>}
    {poll && <>
      <PollStatus poll={poll} onDeadline={deadline} />
      <PollResults poll={poll} />
      {poll.myOptionId && <p className="flash">Ваш вибір: {poll.options.find((o) => o.id === poll.myOptionId)?.title}</p>}
      {poll.canVote && !expired && <PollOptions key={poll.myOptionId ?? 'new'} poll={poll} busy={!actionable}
        onVote={(option) => run(() => pollService.vote(poll.id, option), 'Ваш голос збережено.')} />}
      {poll.canFinalize && <PollFinalization key={poll.serverNow} poll={poll} busy={!actionable}
        onFinalize={(option) => run(() => pollService.finalize(poll.id, option), 'Переможця зафіксовано. Книга залишилася запланованою.')} />}
      {poll.status === 'finalized' && <p className="flash">Книгу обрано. {poll.selectionConsumedAt ? 'Читання обраної книги вже розпочинали.' : 'Початок читання — окрема дія на книжковій полиці.'}</p>}
      {poll.canCancel && !confirmCancel && <span ref={cancelTrigger}><AppButton variant="secondary" disabled={!actionable} onClick={() => setConfirmCancel(true)}>Скасувати голосування</AppButton></span>}
      {poll.canCancel && confirmCancel && <section ref={cancelPanel} className="book-replacement" role="alertdialog" aria-labelledby="cancel-poll-title" aria-describedby="cancel-poll-description"
        onKeyDown={(e) => { if (e.key === 'Escape') dismissCancellation() }}>
        <h2 id="cancel-poll-title">Скасувати це голосування?</h2>
        <p id="cancel-poll-description">Голоси й результати залишаться в історії. Голосування неможливо буде відновити.</p>
        <div className="form-actions"><AppButton disabled={!actionable} onClick={() => void run(() => pollService.cancel(poll.id), 'Голосування скасовано.')}>Підтвердити скасування</AppButton>
          <AppButton variant="secondary" disabled={busy} onClick={dismissCancellation}>Залишити голосування</AppButton></div>
      </section>}
    </>}
  </>
}
export default function ClubPollPage() {
  const { clubId, pollId } = useParams()
  const { clubs } = useClubs()
  const { user } = useAuth()
  const club = clubs.find((c) => c.id === clubId)
  if (!club || !user) return <NotFoundPage title="Клуб не знайдено" />
  return <Poll key={clubId + pollId + user.id} club={club} pollId={pollId} />
}
