import { Link, useNavigate, useSearchParams } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import useClubSelection from '../hooks/useClubSelection.js'
import JoinPage from './JoinPage.jsx'
import NotFoundPage from './NotFoundPage.jsx'

export default function RequestCreatePage({ clubs }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { selectedId, clearSelection } = useClubSelection()
  const clubId = searchParams.get('clubId')

  if (clubId === null) {
    const lastSelectionSearch = selectedId
      ? `?${new URLSearchParams({ clubId: selectedId })}`
      : null

    return (
      <>
        <PageHeading title="Нова заявка" />
        <EmptyState title="Спочатку виберіть клуб.">
          <p><Link to="/clubs">Відкрити каталог</Link></p>
          {lastSelectionSearch && (
            <p>
              <Link to={lastSelectionSearch}>Використати останній вибір</Link>
            </p>
          )}
        </EmptyState>
      </>
    )
  }

  const club = clubs.find((entry) => entry.id === clubId)

  if (!club) {
    return (
      <NotFoundPage
        title="Неможливо підготувати заявку"
        message="Клуб із параметра clubId відсутній у каталозі."
      />
    )
  }

  function handleCancel() {
    clearSelection()
    navigate('/clubs', { replace: true })
  }

  return (
    <JoinPage
      key={`new-${club.id}`}
      title="Нова заявка"
      club={club}
      onCancel={handleCancel}
      cancelLabel="Скасувати чернетку й очистити вибір"
    />
  )
}