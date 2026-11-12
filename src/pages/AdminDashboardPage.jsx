import { useCallback } from 'react'
import { Link } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'
import AdminFeedback from '../components/admin/AdminFeedback.jsx'
import StatIcon from '../components/admin/StatIcon.jsx'
import useAdminResource from '../hooks/useAdminResource.js'
import { adminService } from '../services/adminService.js'

const statuses = [
  ['pending', 'Очікують рішення'], ['approved', 'Схвалених заявок'],
  ['rejected', 'Відхилених заявок'], ['cancelled', 'Скасованих заявок'],
]
const number = (value) => Number(value ?? 0).toLocaleString('uk-UA')
function Metric({ label, value, icon, to, hint }) {
  const content = <><span className="admin-metric-top"><span>{label}</span><span className="admin-metric-icon"><StatIcon type={icon} /></span></span>
    <strong>{number(value)}</strong><span className="admin-metric-hint">{hint}{to && <span aria-hidden="true"> ↗</span>}</span></>
  return to ? <Link className="admin-summary-card" to={to}>{content}</Link> : <div className="admin-summary-card">{content}</div>
}
function Detail({ label, value, to }) {
  return <div><dt>{to ? <Link to={to}>{label}<span aria-hidden="true"> ↗</span></Link> : label}</dt><dd>{number(value)}</dd></div>
}
export default function AdminDashboardPage() {
  const load = useCallback((signal) => adminService.stats({ signal }), [])
  const resource = useAdminResource(load)
  const stats = resource.data
  const requestTotal = statuses.reduce((sum, [key]) => sum + Number(stats?.['requests_' + key] ?? 0), 0)
  return <><PageHeading title="Статистика платформи" /><p className="page-lead">Ключові показники спільноти, клубів і заявок ReadHub.</p>
    <AdminFeedback resource={resource} />
    {stats && !resource.loading && <>
      <section aria-label="Основні показники" className="admin-summary-grid">
        <Metric label="Користувачів" value={stats.users} icon="users" to="/admin/users" hint="Усі облікові записи" />
        <Metric label="Клубів загалом" value={Number(stats.active_clubs ?? 0) + Number(stats.archived_clubs ?? 0)} icon="clubs" to="/admin/clubs" hint="Активні та архівні" />
        <Metric label="Унікальних учасників" value={stats.unique_members} icon="members" hint="Люди, які входять до клубів" />
        <Metric label="Заявок загалом" value={stats.requests} icon="requests" hint="За весь час роботи платформи" />
      </section>
      <h2 className="admin-section-heading">Детальна статистика</h2>
      <div className="admin-insights-grid"><section className="admin-detail-card" aria-label="Користувачі та членство"><h2>Користувачі та членство</h2>
        <dl className="admin-breakdown">
          <Detail label="Активних користувачів" value={Math.max(0, Number(stats.users ?? 0) - Number(stats.blocked_users ?? 0))} to="/admin/users?state=active" />
          <Detail label="Заблокованих користувачів" value={stats.blocked_users} to="/admin/users?state=blocked" />
          <Detail label="Членств у клубах" value={stats.memberships} />
        </dl><p className="field-hint">Одна людина може мати членство в декількох клубах. Ураховано також власників та архівні клуби.</p>
      </section>
      <section className="admin-detail-card" aria-label="Клуби"><h2>Клуби</h2><dl className="admin-breakdown">
        <Detail label="Активних клубів" value={stats.active_clubs} to="/admin/clubs?state=active" />
        <Detail label="Архівних клубів" value={stats.archived_clubs} to="/admin/clubs?state=archived" />
      </dl><p className="field-hint">Архівні клуби зберігають історію спільноти.</p></section></div>
      <section className="admin-detail-card admin-request-analysis" aria-label="Статуси заявок"><h2>Співвідношення статусів заявок</h2>
        <p className="field-hint">За весь час · {number(stats.requests)} заявок</p>
        {requestTotal > 0 ? <div className="admin-request-chart" role="img" aria-label={statuses.map(([key, label]) => `${label}: ${number(stats['requests_' + key])}`).join('; ')}>
          {statuses.map(([key]) => <span key={key} className={`admin-chart-${key}`} style={{ width: `${Number(stats['requests_' + key] ?? 0) / requestTotal * 100}%` }} />)}
        </div> : <p className="admin-chart-empty">Заявок поки немає. Співвідношення з’явиться після першої заявки.</p>}
        <ul className="admin-chart-legend">{statuses.map(([key, label]) => {
          const value = Number(stats['requests_' + key] ?? 0)
          return <li key={key}><span className={`admin-chart-dot admin-chart-${key}`} aria-hidden="true" /><span>{label}</span>
            <strong>{number(value)}</strong><span>{requestTotal ? Math.round(value / requestTotal * 1000) / 10 : 0}%</span></li>
        })}</ul>
      </section>
    </>}
  </>
}
