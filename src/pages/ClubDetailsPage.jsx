import { useState } from 'react'
import { useLocation, useParams } from 'react-router'
import useConfirmAction from '../hooks/useConfirmAction.jsx'
import Link from '../components/navigation/ClubLink.jsx'
import useNavigate from '../hooks/useClubNavigate.js'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import GenreTag from '../components/ui/GenreTag.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import useClubSelection from '../hooks/useClubSelection.js'
import useRequests from '../hooks/useRequests.js'
import { clubFormatOptions, optionLabel } from '../domain/options.js'
import { formatMeetingDate } from '../domain/dates.js'
import { genreColor } from '../domain/genreColor.js'
import NotFoundPage from './NotFoundPage.jsx'
import { isSupabaseData } from '../services/dataSource.js'
import LeaveClubButton from '../components/clubs/LeaveClubButton.jsx'
import RestoreClubButton from '../components/clubs/RestoreClubButton.jsx'
import { formatMeetingTime } from '../domain/meetingValidation.js'

export default function ClubDetailsPage() {
  const { clubId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { clubs, deleteClub, isMutating, reload } = useClubs()
  const { selectClub } = useClubSelection()
  const { requests, status } = useRequests()
  const { ask, confirmation } = useConfirmAction()
  const [actionError, setActionError] = useState('')
  const club = clubs.find((entry) => entry.id === clubId)

  if (!club) {
    return (
      <NotFoundPage
        title="Клуб не знайдено"
        message="У каталозі немає клубу з таким ідентифікатором."
      />
    )
  }

  const color = genreColor(club.genre)
  const isOwner = Boolean(user) && club.ownerId === user.id
  const canManage = isOwner || user?.role === 'admin'
  const canReadPrivateSections = Boolean(user) && (isOwner || club.isMember || user.role === 'admin')
  // Archived club records arrive only when list_clubs permits their metadata.
  // can_read_polls also permits those readers to see archived poll history.
  const canReadPolls = Boolean(user) && (canReadPrivateSections || Boolean(club.archivedAt))
  const requestCount = user && status === 'success'
    ? requests.filter((request) => request.clubId === club.id).length
    : null
  const notice = location.state?.notice

  function handlePrepareRequest() {
    selectClub(club.id)
    const search = new URLSearchParams({ clubId: club.id })
    navigate(`/requests/new?${search}`)
  }

  async function handleDelete() {
    const extra = requestCount
      ? ` Ваші заявки (${requestCount}) залишаться в списку з позначкою про відсутній клуб.`
      : ''
    ask({ title: isSupabaseData ? `Архівувати клуб «${club.name}»?` : `Видалити клуб «${club.name}»?`,
      description: isSupabaseData ? 'Очікувані заявки буде відхилено, історія збережеться.' : `${extra} Скасувати видалення буде неможливо.`,
      action: async () => {
        setActionError('')
        const result = await deleteClub(club.id)
        if (result.ok) navigate('/clubs', { replace: true, state: { notice: isSupabaseData ? 'Клуб архівовано.' : 'Клуб видалено.' } })
        else setActionError(result.message)
        return result
      } })
  }

  const facts = [
    ['Зустрічей на місяць', club.meetingsPerMonth],
    ['Мова спілкування', club.language],
    ['Учасників', club.membersCount],
    ['Засновник', club.ownerName ?? 'Редакція каталогу'],
  ]
  if (requestCount !== null) facts.push(['Ваших заявок', requestCount])

  return (
    <article className="club-page">
      <p className="breadcrumb">
        <Link to="/clubs">Клуби</Link>
        <span aria-hidden="true"> / </span>
        <span>{club.name}</span>
      </p>

      {notice && <p role="status" className="flash">{notice}</p>}
      {actionError && !confirmation && <p role="alert" className="form-alert">{actionError}</p>}
      {confirmation}
      {club.archivedAt && <p className="flash">Клуб архівовано.</p>}

      <header className="club-masthead" style={{ borderLeftColor: color.spine }}>
        <div className="club-row-tags">
          <GenreTag genre={club.genre} />
          <span className="meta-tag">{optionLabel(clubFormatOptions, club.format)}</span>
          {isOwner && <span className="own-tag">Ваш клуб</span>}
        </div>
        <PageHeading title={club.name} />
        <p className="page-lead">{club.description}</p>
      </header>

      <div className="club-columns">
        <div className="club-story">
          <section className="club-reading" aria-label="Поточна книга">
            <h2 className="eyebrow">Зараз у читанні</h2>
            {club.currentBook ? (
              <p className="reading-book">{club.currentBook}</p>
            ) : (
              <p className="reading-book is-empty">Книгу ще не обрано</p>
            )}
          </section>

          <section className="club-next" aria-label="Найближча зустріч">
            <h2 className="eyebrow">Найближча зустріч</h2>
            {club.nextMeetingAt ? <><p className="next-date"><time dateTime={club.nextMeetingAt}>{formatMeetingTime(club.nextMeetingAt)}</time></p>
              <p className="field-hint">Часовий пояс: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p></>
              : <p className="next-note">{club.nextMeeting ? `${formatMeetingDate(club.nextMeeting)} — час не уточнено.` : 'Майбутню зустріч ще не заплановано.'}</p>}
            {club.legacyNextMeeting && <p className="field-hint">Дата зі старого розкладу — час не уточнено: {formatMeetingDate(club.legacyNextMeeting)}</p>}
            {!canReadPrivateSections && <p className="field-hint">Деталі зустрічей доступні учасникам клубу.</p>}
          </section>

          <nav className="club-life" aria-labelledby="club-life-title">
            <h2 id="club-life-title">Життя клубу</h2>
            <ul className="club-life-links">
              {(!club.archivedAt || user) && <li><Link to={`/clubs/${club.id}/books`} className="link-button link-button-secondary">Книги</Link></li>}
              {canReadPolls && <li><Link to={`/clubs/${club.id}/polls`} className="link-button link-button-secondary">Голосування</Link></li>}
              {canReadPrivateSections && <>
                <li><Link to={`/clubs/${club.id}/meetings`} className="link-button link-button-secondary">Зустрічі</Link></li>
                <li><Link to={`/clubs/${club.id}/discussions`} className="link-button link-button-secondary">Обговорення</Link></li>
                {isSupabaseData && <li><Link to={`/clubs/${club.id}/members`} className="link-button link-button-secondary">Учасники</Link></li>}
              </>}
            </ul>
          </nav>

          {!isOwner && !club.isMember && !club.archivedAt && <section className="club-howto" aria-label="Як приєднатися">
            <p className="eyebrow">Як приєднатися</p>
            <ol>
              <li>Натисніть «Обрати й підготувати заявку».</li>
              <li>Розкажіть, чому цікавить клуб, і скільки часу готові приділяти.</li>
              <li>Зберігайте й змінюйте заявку в розділі «Мої заявки».</li>
            </ol>
          </section>}
        </div>

        <aside className="club-aside" aria-label="Деталі та дії">
          <dl className="fact-list">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <section className="club-action-group" aria-labelledby="club-participation-title">
            <h2 id="club-participation-title">Ваша участь</h2>
            <div className="club-actions">
            {isSupabaseData && user && <>
              {club.isMember && !isOwner && <p className="selection-note">Ви учасник клубу.</p>}
              <LeaveClubButton key={club.id + user.id} club={club} disabled={isMutating} />
            </>}
            <AppButton onClick={handlePrepareRequest} disabled={Boolean(club.archivedAt || club.isMember || isOwner)}>
              Обрати й підготувати заявку
            </AppButton>
            {!user && (
              <p className="field-hint">Для заявки потрібно увійти в обліковий запис.</p>
            )}
            </div>
          </section>

          {canManage && (!club.archivedAt || isSupabaseData) && <section className="club-action-group" aria-labelledby="club-management-title">
            <h2 id="club-management-title">Керування клубом</h2>
            <div className="club-actions">
            {isSupabaseData && canManage && <Link to={`/clubs/${club.id}/requests`} className="link-inline">Вхідні заявки</Link>}
            {isSupabaseData && canManage && <RestoreClubButton key={club.id + user.id} club={club} />}
            {canManage && !club.archivedAt && (
              <>
                <Link to={`/clubs/${encodeURIComponent(club.id)}/edit`} className="link-button link-button-secondary">
                  Редагувати клуб
                </Link>
                <AppButton variant="danger" onClick={handleDelete} disabled={isMutating}>
                  {isSupabaseData ? 'Архівувати клуб' : 'Видалити клуб'}
                </AppButton>
              </>
            )}
            </div>
          </section>}
          <div className="club-actions club-utilities">
            {isSupabaseData && user && <AppButton variant="secondary" disabled={isMutating} onClick={() => void reload(true)}>Оновити дані клубу</AppButton>}
            <Link to="/clubs" className="link-inline">До каталогу</Link>
          </div>
        </aside>
      </div>
    </article>
  )
}
