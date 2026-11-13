import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import useAuth from '../hooks/useAuth.js'
import useNotifications from '../hooks/useNotifications.js'
import { notificationService } from '../services/notificationService.js'
import { errorMessage } from '../services/ServiceError.js'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import NotificationItem from '../components/notifications/NotificationItem.jsx'

function Notifications() {
  const [params, setParams] = useSearchParams()
  const filter = params.get('filter') === 'unread' ? 'unread' : 'all'
  const value = Number(params.get('page') ?? 1)
  const page = Number.isInteger(value) && value > 0 && value <= 1000000 ? value : 1
  const { invalidate, revision } = useNotifications()
  const [result, setResult] = useState(null), [failure, setFailure] = useState(null)
  const [busy, setBusy] = useState(null), [writeError, setWriteError] = useState(''), [notice, setNotice] = useState('')
  const lock = useRef(false), alive = useRef(false), heading = useRef(null), read = useRef(null)
  const key = `${filter}:${page}:${revision}`
  const data = result?.key === key ? result.data : null
  const error = failure?.key === key ? failure.message : ''
  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    read.current = controller
    notificationService.list({ filter, page, signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) { setResult({ key, data }); setFailure(null) } },
      (cause) => { if (!controller.signal.aborted) setFailure({ key, message: errorMessage(cause) }) })
    return () => { alive.current = false; controller.abort() }
  }, [filter, page, key])
  function reload() {
    if (lock.current) return
    setWriteError('')
    void invalidate()
  }
  async function markRead(id) {
    if (lock.current) return
    lock.current = true; setBusy(id); setWriteError(''); setNotice('')
    try {
      await notificationService.markRead(id)
      if (!alive.current) return
      read.current?.abort()
      setNotice('Сповіщення позначено прочитаним.'); heading.current?.focus()
      await invalidate()
    } catch (cause) { if (alive.current) setWriteError(errorMessage(cause)) }
    finally { lock.current = false; if (alive.current) setBusy(null) }
  }
  function change(nextFilter, nextPage) {
    if (lock.current) return
    setNotice(''); setWriteError('')
    setFailure(null); setResult(null)
    setParams({ filter: nextFilter, page: String(nextPage) })
  }
  return <div className="notifications-page">
    <div tabIndex={-1} ref={heading}><PageHeading title="Сповіщення" /></div>
    <p className="page-lead">Заявки, рішення та нагадування про зустрічі. Відкриття списку не позначає їх прочитаними.</p>
    <div className="page-toolbar"><AppButton variant="secondary" disabled={busy !== null} onClick={reload}>Оновити сповіщення</AppButton></div>
    <nav className="chip-group" aria-label="Фільтр сповіщень">{[['all', 'Усі'], ['unread', 'Непрочитані']].map(([v, label]) =>
      <button type="button" key={v} className="chip" aria-pressed={filter === v} disabled={busy !== null} onClick={() => change(v, 1)}>{label}</button>)}</nav>
    {notice && <p role="status" className="flash">{notice}</p>}
    {writeError && <p role="alert" className="form-alert">{writeError}</p>}
    {!data && !error && <p role="status">Завантаження сповіщень…</p>}
    {error && <><p role="alert" className="form-alert">{error}</p><AppButton onClick={reload}>Спробувати ще раз</AppButton></>}
    {data && <>{data.items.length ? <ul className="notification-list">{data.items.map((n) => <li key={n.id}>
      <NotificationItem notification={n} busy={busy !== null} onRead={(id) => void markRead(id)} /></li>)}</ul>
      : <p className="empty-state">{data.total > 0 ? 'На цій сторінці сповіщень немає. Поверніться на попередню сторінку.' : filter === 'unread' ? 'Непрочитаних сповіщень немає.' : 'Сповіщень поки немає.'}</p>}
      <nav className="page-toolbar" aria-label="Сторінки сповіщень"><AppButton variant="secondary" disabled={busy !== null || page === 1} onClick={() => change(filter, page - 1)}>Попередня</AppButton>
        <span>Сторінка {page} · Усього: {data.total}</span><AppButton variant="secondary" disabled={busy !== null || page * 20 >= data.total} onClick={() => change(filter, page + 1)}>Наступна</AppButton></nav></>}
  </div>
}
export default function NotificationsPage() {
  const { user } = useAuth()
  return <Notifications key={user.id} />
}
