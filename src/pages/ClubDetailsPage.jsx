import { Link, useNavigate, useParams } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import ReadingStatusBadge from '../components/clubs/ReadingStatusBadge.jsx'
import useClubSelection from '../hooks/useClubSelection.js'
import useRequests from '../hooks/useRequests.js'
import { clubFormatOptions, optionLabel } from '../domain/options.js'
import { formatMeetingDate } from '../domain/dates.js'
import NotFoundPage from './NotFoundPage.jsx'

export default function ClubDetailsPage({ clubs }) {
  const { clubId } = useParams()
  const navigate = useNavigate()
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

  const requestCount = status === 'success'
    ? requests.filter((request) => request.clubId === club.id).length
    : null

  function handlePrepareRequest() {
    selectClub(club.id)
    const search = new URLSearchParams({ clubId: club.id })
    navigate(`/requests/new?${search}`)
  }

  return (
    <>
      <div className="club-hero">
        <div className="club-card-top">
          <p className="genre">{club.genre}</p>
          <span className={`format-badge format-${club.format}`}>
            {optionLabel(clubFormatOptions, club.format)}
          </span>
        </div>
        <PageHeading title={club.name} />
        <p className="lead">{club.description}</p>
        <p><ReadingStatusBadge currentBook={club.currentBook} /></p>
      </div>

      <dl className="meta-grid">
        <div className="meta-item">
          <dt>Найближча зустріч</dt>
          <dd>{formatMeetingDate(club.nextMeeting)}</dd>
        </div>
        <div className="meta-item">
          <dt>Зустрічей на місяць</dt>
          <dd>{club.meetingsPerMonth}</dd>
        </div>
        <div className="meta-item">
          <dt>Мова спілкування</dt>
          <dd>{club.language}</dd>
        </div>
        <div className="meta-item">
          <dt>Учасників</dt>
          <dd>{club.membersCount}</dd>
        </div>
        {requestCount !== null && (
          <div className="meta-item">
            <dt>Поданих заявок</dt>
            <dd>{requestCount}</dd>
          </div>
        )}
      </dl>

      <div className="page-toolbar">
        <AppButton onClick={handlePrepareRequest}>
          Обрати й підготувати заявку
        </AppButton>
        <Link to="/clubs" className="link-inline">До каталогу без фільтрів</Link>
      </div>
    </>
  )
}