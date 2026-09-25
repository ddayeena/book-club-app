import HomePage from './HomePage.jsx'
import useClubSelection from '../hooks/useClubSelection.js'

export default function CatalogContainer({ clubs }) {
  const { selectedId, selectClub } = useClubSelection()

  return (
    <HomePage clubs={clubs} selectedId={selectedId} onSelect={selectClub} />
  )
}