import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import PollForm from '../components/polls/PollForm.jsx'
import PollStatus from '../components/polls/PollStatus.jsx'
import { pollService } from '../services/pollService.js'
import { bookService } from '../services/bookService.js'
import { errorMessage } from '../services/ServiceError.js'
import NotFoundPage from './NotFoundPage.jsx'

function Polls({ club, user }) {
  const navigate = useNavigate()
  const [records, setRecords] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const alive = useRef(false)
  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    Promise.all([pollService.list(club.id, { signal: controller.signal }), bookService.getAll(club.id, { signal: controller.signal })]).then(
      ([polls, books]) => { if (!controller.signal.aborted) setRecords({ polls, books }) },
      (cause) => { if (!controller.signal.aborted) setError(errorMessage(cause)) },
    )
    return () => { alive.current = false; controller.abort() }
  }, [club.id, attempt])
  function refresh() { if (!lock.current) { setRecords(null); setError(''); setAttempt((v) => v + 1) } }
  async function create(draft) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const poll = await pollService.create(club.id, draft)
      if (alive.current) navigate(`/clubs/${club.id}/polls/${poll.id}`)
    } catch (cause) { if (alive.current) setError(errorMessage(cause)) }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  const unresolved = records?.polls.find((p) => !p.finalizedAt && !p.cancelledAt)
  const planned = records?.books.filter((b) => b.status === 'planned') ?? []
  return <>
    <p className="breadcrumb"><Link to={`/clubs/${club.id}`}>{club.name}</Link> / Голосування</p>
    <PageHeading title={`Голосування: ${club.name}`} />
    <p className="page-lead">Обираємо наступну книгу разом.</p>
    <Link to={`/clubs/${club.id}/books`} className="link-button link-button-secondary">Книжкова полиця</Link>
    {club.archivedAt && <p className="flash">Клуб архівовано. Доступна лише історія голосувань.</p>}
    {error && <p className="form-alert" role="alert">{error}</p>}
    <div className="page-toolbar"><AppButton variant="secondary" disabled={busy} onClick={refresh}>Оновити голосування</AppButton></div>
    {!records && !error && <p role="status">Завантаження голосувань…</p>}
    {unresolved && <p className="flash">Спочатку завершіть або скасуйте <Link to={`/clubs/${club.id}/polls/${unresolved.id}`}>поточне голосування</Link>. Саме завершення строку не відкриває нове.</p>}
    {records && user.id === club.ownerId && !club.archivedAt && !unresolved && (planned.length >= 2
      ? <PollForm books={planned} busy={busy} onSave={create} />
      : <p className="flash">Для нового голосування додайте щонайменше дві заплановані книги на полицю.</p>)}
    {records && <section aria-label="Історія голосувань"><h2>Голосування клубу</h2>
      {!records.polls.length && <p>Голосувань поки немає.</p>}
      <ul className="poll-list">{records.polls.map((poll) => <li key={poll.id} className="book-editor">
        <h3><Link to={`/clubs/${club.id}/polls/${poll.id}`}>{poll.title}</Link></h3>
        <PollStatus poll={poll} /><p>Голосів: {poll.totalVotes}</p>
      </li>)}</ul>
    </section>}
  </>
}
export default function ClubPollsPage() {
  const { clubId } = useParams()
  const { clubs } = useClubs()
  const { user } = useAuth()
  const club = clubs.find((c) => c.id === clubId)
  if (!club || !user) return <NotFoundPage title="Клуб не знайдено" />
  return <Polls key={clubId + user.id} club={club} user={user} />
}
