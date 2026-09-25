import JoinPage from './JoinPage.jsx'
import useClubSelection from '../hooks/useClubSelection.js'

export default function JoinContainer() {
  const { selectedId, selectedClub, clearSelection } = useClubSelection()

  return (
    <JoinPage
      key={selectedId ?? 'empty'}
      club={selectedClub}
      onClearSelection={clearSelection}
    />
  )
}