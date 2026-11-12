import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import MeetingCard from '../components/meetings/MeetingCard.jsx'
import { meetingService } from '../services/meetingService.js'
import { meetingStatuses } from '../domain/meetingValidation.js'
import { errorMessage } from '../services/ServiceError.js'
import NotFoundPage from './NotFoundPage.jsx'

function Meetings({ club }) {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const status = Object.hasOwn(meetingStatuses, params.get('status')) ? params.get('status') : 'upcoming'
  const rawPage = Number(params.get('page') ?? 1)
  const page = Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 1000000 ? rawPage : 1
  const [result, setResult] = useState(null)
  const [failure, setFailure] = useState(null)
  const readKey = `${status}:${page}`
  const data = result?.key === readKey ? result.data : null
  const error = failure?.key === readKey ? failure.message : ''
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    meetingService.list(club.id, { status, page, signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) setResult({ key: readKey, data }) },
      (cause) => { if (!controller.signal.aborted) setFailure({ key: readKey, message: errorMessage(cause) }) })
    return () => controller.abort()
  }, [club.id, status, page, readKey, attempt])
  function load(nextStatus = status, nextPage = page) {
    setResult(null); setFailure(null)
    if (nextStatus === status && nextPage === page) setAttempt((v) => v + 1)
    else setParams({ status: nextStatus, page: String(nextPage) })
  }
  return <div className="meetings-page"><p className="breadcrumb"><Link to={`/clubs/${club.id}`}>{club.name}</Link> / Зустрічі</p>
    <PageHeading title={`Зустрічі: ${club.name}`} />
    {club.archivedAt && <p className="flash">Клуб архівовано. Зустрічі доступні лише для перегляду.</p>}
    <div className="page-toolbar">{user.id === club.ownerId && !club.archivedAt && <Link className="link-button" to={`/clubs/${club.id}/meetings/new`}>Створити зустріч</Link>}
      <AppButton variant="secondary" onClick={() => load()}>Оновити зустрічі</AppButton></div>
    <nav className="chip-group" aria-label="Категорія зустрічей">{Object.entries(meetingStatuses).map(([value, label]) =>
      <button className="chip" key={value} aria-current={status === value ? 'page' : undefined} onClick={() => load(value, 1)}>{label}</button>)}</nav>
    {!data && !error && <p role="status">Завантаження зустрічей…</p>}
    {error && <><p role="alert" className="form-alert">{error}</p><AppButton onClick={() => load()}>Спробувати ще раз</AppButton></>}
    {data && <>{data.items.length ? <ul className="meeting-list">{data.items.map((m) => <li key={m.id}><MeetingCard meeting={m} /></li>)}</ul>
      : <p className="empty-state">У цій категорії зустрічей поки немає.</p>}
      <nav className="page-toolbar" aria-label="Сторінки зустрічей"><AppButton variant="secondary" disabled={page === 1} onClick={() => load(status, page - 1)}>Попередня</AppButton>
        <span>Сторінка {page} · Усього: {data.total}</span><AppButton variant="secondary" disabled={page * 20 >= data.total} onClick={() => load(status, page + 1)}>Наступна</AppButton></nav></>}
  </div>
}
export default function ClubMeetingsPage() {
  const { clubId } = useParams(), { clubs } = useClubs(), { user } = useAuth()
  const club = clubs.find((c) => c.id === clubId)
  if (!club || !user) return <NotFoundPage title="Клуб не знайдено" />
  if (!(club.ownerId === user.id || club.isMember || user.role === 'admin')) return <NotFoundPage title="Зустрічі доступні лише учасникам клубу" />
  return <Meetings key={clubId + user.id} club={club} />
}

