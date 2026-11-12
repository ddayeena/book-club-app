import { Link } from 'react-router'
import useNotifications from '../../hooks/useNotifications.js'
export default function NotificationBell() {
  const { count, error } = useNotifications()
  const description = error ? 'Кількість непрочитаних недоступна' : count === null ? 'Кількість завантажується' : `Непрочитаних: ${count}`
  return <Link className="notification-bell" to="/notifications" aria-label={`Сповіщення. ${description}`} title={description}>
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Z"/><path d="M10 20h4"/></svg>
    {count !== null && count > 0 && <span className="notification-count" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
    {(error || count === null) && <span className="notification-unknown" aria-hidden="true">?</span>}
  </Link>
}
