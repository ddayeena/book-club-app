import ClubsListPage from './ClubsListPage.jsx'
import useClubSelection from '../hooks/useClubSelection.js'

export default function CatalogContainer({ clubs }) {
  const { selectedId, selectClub } = useClubSelection()

  return (
    <ClubsListPage clubs={clubs} selectedId={selectedId} onSelect={selectClub} />
  )
}