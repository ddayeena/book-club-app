import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import Link from '../components/navigation/ClubLink.jsx'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import { requestService } from '../services/requestService.js'
import { errorMessage } from '../services/ServiceError.js'
import { requestStatusLabel } from '../domain/requestStatus.js'
import NotFoundPage from './NotFoundPage.jsx'
import useConfirmAction from '../hooks/useConfirmAction.jsx'

function Incoming({ club }) {
  const { ask, confirmation } = useConfirmAction()
  const { user } = useAuth()
  const { reload } = useClubs()
  const [requests, setRequests] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const lock = useRef(false)
  const alive = useRef(false)
  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    requestService.getIncoming(club.id, { signal: controller.signal }).then(
      (records) => { if (!controller.signal.aborted) { setRequests(records); setStatus('success') } },
      (cause) => { if (!controller.signal.aborted) { setError(errorMessage(cause)); setStatus('error') } },
    )
    return () => { alive.current = false; controller.abort() }
  }, [club.id, attempt])
  async function review(id, decision) {
    if (lock.current) return false
    lock.current = true; setBusy(true); setError('')
    try {
      const record = await requestService.review(id, decision, comment)
      if (alive.current) {
        setRequests((previous) => previous.map((entry) => entry.id === record.id ? record : entry))
        setComment('')
        await reload()
      }
      return true
    } catch (cause) { if (alive.current) setError(errorMessage(cause)); return { ok: false, message: errorMessage(cause) } }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  return <><PageHeading title={`Вхідні заявки: ${club.name}`} /><p><Link to={`/clubs/${club.id}`}>До клубу</Link></p>
    {confirmation}
    {error && !confirmation && <p role="alert">{error}</p>}
    {status === 'loading' && <p role="status">Завантаження заявок…</p>}
    {status === 'error' && <AppButton onClick={() => { setStatus('loading'); setError(''); setAttempt((n) => n + 1) }}>Повторити</AppButton>}
    {status === 'success' && requests.length === 0 && <p>Вхідних заявок ще немає.</p>}
    <label htmlFor="decision-comment">Коментар до рішення</label>
    <textarea id="decision-comment" maxLength={500} value={comment} disabled={busy} onChange={(event) => setComment(event.target.value)} />
    {requests.map((request) => <article className="summary-card" key={request.id}>
      <h2>{requestStatusLabel(request.status)}</h2>
      <p>{request.motivation}</p><p>{request.weeklyHours} год/тиждень; {request.experience}; {request.participationFormat}</p>
      <p>{request.contactEmail || 'Контактну пошту не вказано'}</p>
      {request.decisionComment && <p>{request.decisionComment}</p>}
      {request.status === 'pending' && !club.archivedAt && request.ownerId !== user.id && <div className="page-toolbar">
        <AppButton disabled={busy} onClick={() => ask({ title: 'Схвалити заявку?', description: 'Заявник стане учасником клубу та отримає повідомлення про рішення.', danger: false, action: () => review(request.id, 'approved') })}>Схвалити</AppButton>
        <AppButton disabled={busy} variant="secondary" onClick={() => ask({ title: 'Відхилити заявку?', description: 'Заявку буде відхилено зі збереженням історії та повідомленням заявнику.', action: () => review(request.id, 'rejected') })}>Відхилити</AppButton>
      </div>}
    </article>)}
  </>
}
export default function ClubRequestsPage() {
  const { clubId } = useParams()
  const { clubs } = useClubs()
  const { user } = useAuth()
  const club = clubs.find((entry) => entry.id === clubId)
  if (!club || (club.ownerId !== user.id && user.role !== 'admin')) return <NotFoundPage title="Немає доступу до заявок клубу" />
  return <Incoming key={clubId + user.id} club={club} />
}
