import { Link, useLocation, useNavigate, useParams } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import GenreTag from '../components/ui/GenreTag.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import useClubSelection from '../hooks/useClubSelection.js'
import useRequests from '../hooks/useRequests.js'
import { clubFormatOptions, optionLabel } from '../domain/options.js'
import { formatMeetingDate, meetingParts } from '../domain/dates.js'
import { genreColor } from '../domain/genreColor.js'
import NotFoundPage from './NotFoundPage.jsx'
import { isSupabaseData } from '../services/dataSource.js'
import LeaveClubButton from '../components/clubs/LeaveClubButton.jsx'
import RestoreClubButton from '../components/clubs/RestoreClubButton.jsx'
import { formatMeetingTime, localDateTime } from '../domain/meetingValidation.js'

export default function ClubDetailsPage() {
  const { clubId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { clubs, deleteClub, isMutating, reload } = useClubs()
  const { selectClub } = useClubSelection()
  const { requests, status } = useRequests()
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
  const canReadMeetings = user && (isOwner || club.isMember || user.role === 'admin')
  const requestCount = user && status === 'success'
    ? requests.filter((request) => request.clubId === club.id).length
    : null
  const notice = location.state?.notice
  const meeting = meetingParts(club.nextMeetingAt ? localDateTime(club.nextMeetingAt).slice(0, 10) : club.nextMeeting)

  function handlePrepareRequest() {
    selectClub(club.id)
    const search = new URLSearchParams({ clubId: club.id })
    navigate(`/requests/new?${search}`)
  }

  async function handleDelete() {
    const extra = requestCount
      ? ` Ваші заявки (${requestCount}) залишаться в списку з позначкою про відсутній клуб.`
      : ''
    if (!window.confirm(isSupabaseData ? `Архівувати клуб «${club.name}»? Очікувані заявки буде відхилено, історія збережеться.` : `Видалити клуб «${club.name}»?${extra} Скасувати видалення буде неможливо.`)) {
      return
    }
    const result = await deleteClub(club.id)
    if (result.ok) {
      navigate('/clubs', { replace: true, state: { notice: isSupabaseData ? 'Клуб архівовано.' : 'Клуб видалено.' } })
    } else {
      window.alert(result.message)
    }
  }

  const facts = [
    ['Найближча зустріч', club.nextMeetingAt ? formatMeetingTime(club.nextMeetingAt) : formatMeetingDate(club.nextMeeting)],
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
            <p className="eyebrow">Зараз у читанні</p>
            {club.currentBook ? (
              <p className="reading-book">{club.currentBook}</p>
            ) : (
              <p className="reading-book is-empty">Книгу ще не обрано</p>
            )}
          </section>

          <section className="club-next" aria-label="Найближча зустріч">
            <p className="eyebrow">Найближча зустріч</p>
            <p className="next-date">
              <strong>{meeting.day}</strong>
              <span>{meeting.month}</span>
            </p>
            <p className="next-note">
              {optionLabel(clubFormatOptions, club.format)}, {club.language.toLocaleLowerCase('uk')} мова,
              зустрічей на місяць: {club.meetingsPerMonth}.
            </p>
            {club.nextMeetingAt && <p><time dateTime={club.nextMeetingAt}>{formatMeetingTime(club.nextMeetingAt)}</time> · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>}
            {club.legacyNextMeeting && <p className="field-hint">Дата зі старого розкладу — час не уточнено: {formatMeetingDate(club.legacyNextMeeting)}</p>}
            {canReadMeetings ? <Link to={`/clubs/${club.id}/meetings`} className="link-inline">Усі зустрічі</Link>
              : <p className="field-hint">Деталі зустрічей доступні учасникам клубу.</p>}
          </section>

          <section className="club-howto" aria-label="Як приєднатися">
            <p className="eyebrow">Як приєднатися</p>
            <ol>
              <li>Натисніть «Обрати й підготувати заявку».</li>
              <li>Розкажіть, чому цікавить клуб, і скільки часу готові приділяти.</li>
              <li>Зберігайте й змінюйте заявку в розділі «Мої заявки».</li>
            </ol>
          </section>
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

          <div className="club-actions">
            <Link to={`/clubs/${club.id}/books`} className="link-button link-button-secondary">Книжкова полиця</Link>
            {user && <Link to={`/clubs/${club.id}/polls`} className="link-button link-button-secondary">Голосування за книги</Link>}
            {isSupabaseData && user && <>
              {club.isMember && <p className="selection-note">Ви учасник клубу.</p>}
              <LeaveClubButton key={club.id + user.id} club={club} disabled={isMutating} />
              <AppButton variant="secondary" disabled={isMutating} onClick={() => void reload(true)}>Оновити дані клубу</AppButton>
            </>}
            <AppButton onClick={handlePrepareRequest} disabled={Boolean(club.archivedAt || club.isMember)}>
              Обрати й підготувати заявку
            </AppButton>
            {!user && (
              <p className="field-hint">Для заявки потрібно увійти в обліковий запис.</p>
            )}
            {isSupabaseData && (club.isMember || canManage) && <Link to={`/clubs/${club.id}/members`} className="link-inline">Учасники клубу</Link>}
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
            <Link to="/clubs" className="link-inline">До каталогу</Link>
          </div>
        </aside>
      </div>
    </article>
  )
}
