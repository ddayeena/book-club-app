import { useCallback, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import AdminFeedback from '../components/admin/AdminFeedback.jsx'
import AdminConfirmation from '../components/admin/AdminConfirmation.jsx'
import AdminClubMembers from '../components/admin/AdminClubMembers.jsx'
import useAdminResource from '../hooks/useAdminResource.js'
import { adminService } from '../services/adminService.js'
import { clubFormatOptions, optionLabel } from '../domain/options.js'

function ClubDetails({ clubId }) {
  const location = useLocation()
  const load = useCallback((signal) => adminService.club(clubId, { signal }), [clubId])
  const resource = useAdminResource(load)
  const [confirming, setConfirming] = useState(false)
  const opener = useRef(null)
  const heading = useRef(null)
  const club = resource.data
  function close() { setConfirming(false); requestAnimationFrame(() => opener.current?.querySelector('button')?.focus()) }
  async function archive() {
    if (await resource.run(() => adminService.archive(club.id), 'Клуб архівовано.')) {
      setConfirming(false); heading.current?.focus()
    }
  }
  async function restore() {
    if (await resource.run(() => adminService.restore(club.id), 'Клуб відновлено.')) {
      setConfirming(false); heading.current?.focus()
    }
  }
  return <>
    <Link className="admin-back-link" to={`/admin/clubs${location.search}`}>← До списку клубів</Link>
    <div className="admin-club-title" ref={heading} tabIndex={-1}><PageHeading title={club?.name ?? 'Деталі клубу'} />
      {club && !resource.loading && <span className={`admin-status${club.archivedAt ? ' admin-status-archived' : ''}`}>{club.archivedAt ? 'Архівний' : 'Активний'}</span>}
    </div>
    <AdminFeedback resource={{ ...resource, error: confirming && club ? '' : resource.error }} />
    {!resource.loading && !resource.error && !club && <section className="admin-detail-card"><h2>Клуб не знайдено</h2><p>Клуб відсутній або недоступний для цього облікового запису.</p></section>}
    {club && !resource.loading && <>
      <dl className="admin-user-counts" aria-label="Показники клубу">
        <div><dt>Учасників</dt><dd>{club.membersCount}</dd></div>
        <div><dt>Зустрічей на місяць</dt><dd>{club.meetingsPerMonth ?? '—'}</dd></div>
        <div><dt>Створено</dt><dd className="admin-stat-date">{club.createdAt ? new Date(club.createdAt).toLocaleDateString('uk-UA') : 'Дата не вказана'}</dd></div>
      </dl>
      <div className="admin-club-sections">
        <section className="admin-detail-card" aria-label="Основна інформація про клуб"><h2>Основна інформація</h2>
          <dl className="admin-facts"><div><dt>Жанр</dt><dd>{club.genre || 'Не вказано'}</dd></div>
            <div><dt>Формат</dt><dd>{optionLabel(clubFormatOptions, club.format)}</dd></div>
            <div><dt>Мова</dt><dd>{club.language || 'Не вказано'}</dd></div>
            <div><dt>Поточна книга</dt><dd>{club.currentBook || 'Немає поточної книги'}</dd></div>
            <div><dt>Наступна зустріч</dt><dd>{club.nextMeeting ? new Date(club.nextMeeting + 'T12:00:00').toLocaleDateString('uk-UA') : 'Не заплановано'}</dd></div>
            {club.archivedAt && <div><dt>Архівовано</dt><dd>{new Date(club.archivedAt).toLocaleString('uk-UA')}</dd></div>}
            <div><dt>ID клубу</dt><dd className="admin-id">{club.id}</dd></div>
          </dl>
        </section>
        <section className="admin-detail-card" aria-label="Власник клубу"><h2>Власник клубу</h2>
          <div className="admin-owner-summary"><span className="admin-owner-mark" aria-hidden="true">{(club.ownerName || '?').slice(0, 1).toUpperCase()}</span>
            <div>{club.ownerId ? <Link to={`/admin/users/${club.ownerId}`}>{club.ownerName || 'Переглянути користувача'}</Link> : <p>{club.ownerName || 'Не вказано'}</p>}
              <span className="admin-id">{club.ownerId}</span></div></div>
          <p className="field-hint">Профіль власника, його клуби та стан доступу.</p>
        </section>
        {club.description && <section className="admin-detail-card admin-club-description-card" aria-label="Опис клубу"><h2>Опис клубу</h2>
          <p className="admin-club-description">{club.description}</p></section>}
        <AdminClubMembers key={club.id} clubId={club.id} ownerId={club.ownerId} />
        <section className="admin-detail-card admin-club-actions" aria-label="Адміністративні дії"><h2>Адміністративні дії</h2>
          <p className="field-hint">{club.archivedAt ? 'Клуб архівовано. Його дані та історія збережені.' : 'Архівування збереже історію клубу, відхилить очікувані заявки та скасує незавершене голосування.'}</p>
          <div className="form-actions"><Link to={`/clubs/${club.id}`}>Переглянути на сайті</Link>
            <span ref={opener}><AppButton variant="secondary" disabled={resource.busy} onClick={() => setConfirming(true)}>{club.archivedAt ? 'Відновити клуб' : 'Архівувати клуб'}</AppButton></span></div>
          {confirming && !club.archivedAt && <AdminConfirmation title="Архівувати клуб?" busy={resource.busy} error={resource.error} onCancel={close} onConfirm={archive}>
            <p><strong>{club.name}</strong></p><p>Клуб залишиться в історії. Очікувані заявки буде відхилено, незавершене голосування — скасовано.</p>
          </AdminConfirmation>}
          {confirming && club.archivedAt && <AdminConfirmation title="Відновити клуб?" danger={false} busy={resource.busy} error={resource.error} onCancel={close} onConfirm={restore}>
            <p>Клуб знову стане активним і доступним у каталозі. Раніше скасовані зустрічі та голосування автоматично не відновляться.</p>
          </AdminConfirmation>}
        </section>
      </div>
    </>}
  </>
}
export default function AdminClubDetailsPage() {
  const { clubId } = useParams()
  return <ClubDetails key={clubId} clubId={clubId} />
}
