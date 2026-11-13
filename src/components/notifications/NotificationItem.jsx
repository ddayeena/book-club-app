import { Link } from 'react-router'
import AppButton from '../ui/AppButton.jsx'
const labels = { new_request: 'Нова заявка', request_decision: 'Рішення щодо заявки', meeting_reminder: 'Нагадування про зустріч' }
export default function NotificationItem({ notification, busy, onRead }) {
  return <article className={`notification-card${notification.readAt ? '' : ' notification-unread'}`}>
    <div className="notification-meta"><span>{labels[notification.type] ?? 'Сповіщення'}</span>
      <time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString('uk-UA')}</time></div>
    <p>{notification.body}</p>
    {notification.isStale && <p className="field-hint">Неактуальне нагадування: час або стан зустрічі змінився, чи ви більше не є учасником.</p>}
    <div className="form-actions">
      {notification.target ? <Link to={notification.target}>Переглянути</Link> : <span className="field-hint">Пов’язані дані зараз недоступні.</span>}
      {notification.readAt ? <span className="field-hint">Прочитано</span>
        : <AppButton variant="secondary" disabled={busy} onClick={() => onRead(notification.id)}>{busy ? 'Збереження…' : 'Позначити прочитаним'}</AppButton>}
    </div>
  </article>
}
