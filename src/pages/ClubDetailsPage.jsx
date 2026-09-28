import { Link, useNavigate, useParams } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import ReadingStatusBadge from '../components/clubs/ReadingStatusBadge.jsx'
import useClubSelection from '../hooks/useClubSelection.js'
import NotFoundPage from './NotFoundPage.jsx'

export default function ClubDetailsPage({ clubs }) {
  const { clubId } = useParams()
  const navigate = useNavigate()
  const { selectClub } = useClubSelection()
  const club = clubs.find((entry) => entry.id === clubId)

  if (!club) {
    return (
      <NotFoundPage
        title="Клуб не знайдено"
        message="У каталозі немає клубу з таким ідентифікатором."
      />
    )
  }

  function handlePrepareRequest() {
    selectClub(club.id)
    const search = new URLSearchParams({ clubId: club.id })
    navigate(`/requests/new?${search}`)
  }

  return (
    <>
      <PageHeading title={club.name} />
      <p className="genre">{club.genre}</p>
      <p>{club.description}</p>
      <p><ReadingStatusBadge currentBook={club.currentBook} /></p>
      <p className="members">Учасників: {club.membersCount}</p>
      <AppButton onClick={handlePrepareRequest}>
        Обрати й підготувати заявку
      </AppButton>
      <p><Link to="/clubs">До каталогу без фільтрів</Link></p>
    </> 
  )
}