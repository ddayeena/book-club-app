import { useCallback, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import useAuth from '../hooks/useAuth.js'
import useAdminResource from '../hooks/useAdminResource.js'
import { adminService } from '../services/adminService.js'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import AdminFeedback from '../components/admin/AdminFeedback.jsx'
import AdminConfirmation from '../components/admin/AdminConfirmation.jsx'

function Clubs({ clubs, title, role }) {
  return <section className="admin-detail-card" aria-label={title}><h2>{title} <span className="admin-count">{clubs.length}</span></h2>
    {clubs.length ? <ul className="admin-user-clubs">{clubs.map((club) => <li key={club.id}>
      <Link to={`/admin/clubs/${club.id}`}>{club.name}</Link>
      <div><span className="field-hint">{role}</span><span className={`admin-status${club.archivedAt ? ' admin-status-archived' : ''}`}>{club.archivedAt ? 'Архівний' : 'Активний'}</span></div>
    </li>)}</ul> : <p className="field-hint">Клубів у цьому списку поки немає.</p>}
  </section>
}
function UserDetails({ userId }) {
  const { user: actor } = useAuth()
  const location = useLocation()
  const load = useCallback((signal) => adminService.user(userId, { signal }), [userId])
  const resource = useAdminResource(load)
  const [confirming, setConfirming] = useState(false)
  const opener = useRef(null)
  const profile = resource.data
  function close() { setConfirming(false); requestAnimationFrame(() => opener.current?.querySelector('button')?.focus()) }
  async function changeAccess() {
    const message = profile.isBlocked ? 'Користувача розблоковано.' : 'Користувача заблоковано.'
    if (await resource.run(() => adminService.setBlocked(profile.id, !profile.isBlocked), message)) close()
  }
  return <>
    <Link className="admin-back-link" to={`/admin/users${location.search}`}>← До списку користувачів</Link>
    <PageHeading title={profile?.name ?? 'Деталі користувача'} />
    <AdminFeedback resource={resource} />
    {!resource.loading && !resource.error && !profile && <section className="admin-detail-card"><h2>Користувача не знайдено</h2><p>Профіль відсутній або недоступний.</p></section>}
    {profile && !resource.loading && <>
      <div className="admin-detail-heading"><div className="admin-row-actions">
        <span className={`admin-status${profile.isBlocked ? ' admin-status-blocked' : ''}`}>{profile.isBlocked ? 'Заблоковано' : 'Активний'}</span>
        <span>{profile.role === 'admin' ? 'Адміністратор' : 'Користувач'} ({profile.role})</span>
        {profile.id === actor.id && <span className="field-hint">Це ваш обліковий запис</span>}</div>
        <span ref={opener}><AppButton variant="secondary" disabled={resource.busy || profile.id === actor.id} onClick={() => setConfirming(true)}>
          {profile.isBlocked ? 'Розблокувати користувача' : 'Заблокувати користувача'}</AppButton></span>
      </div>
      {confirming && <AdminConfirmation title={profile.isBlocked ? 'Розблокувати користувача?' : 'Заблокувати користувача?'} busy={resource.busy} onCancel={close} onConfirm={() => void changeAccess()}>
        <p><strong>{profile.name}</strong></p><p>Профіль, клуби, членство та історія зберігаються. Зміниться лише стан доступу.</p>
      </AdminConfirmation>}
      <section className="admin-detail-card"><h2>Основна інформація</h2><dl className="admin-facts">
        <div><dt>ID користувача</dt><dd className="admin-id">{profile.id}</dd></div>
        <div><dt>Дата реєстрації</dt><dd>{profile.createdAt ? new Date(profile.createdAt).toLocaleString('uk-UA') : 'Дата не вказана'}</dd></div>
      </dl></section>
      <dl className="admin-user-counts" aria-label="Клубна активність">
        <div><dt>Створених клубів</dt><dd>{profile.ownedClubs.length}</dd></div>
        <div><dt>Членств у клубах</dt><dd>{profile.membershipsCount}</dd></div>
        <div><dt>Участь в інших клубах</dt><dd>{profile.joinedClubs.length}</dd></div>
      </dl>
      <p className="field-hint admin-membership-note">Членства враховують також власні клуби. У списках нижче кожен клуб показано один раз. Ураховано активні та архівні клуби.</p>
      <div className="admin-detail-grid"><Clubs clubs={profile.ownedClubs} title="Власні клуби" role="Власник" />
        <Clubs clubs={profile.joinedClubs} title="Участь в інших клубах" role="Учасник" /></div>
    </>}
  </>
}
export default function AdminUserDetailsPage() {
  const { userId } = useParams()
  return <UserDetails key={userId} userId={userId} />
}
