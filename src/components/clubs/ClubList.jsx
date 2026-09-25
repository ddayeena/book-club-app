import ClubCard from './ClubCard.jsx'
import EmptyState from '../ui/EmptyState.jsx'

export default function ClubList({
  clubs,
  selectedId,
  onSelect,
  emptyTitle = 'Клубів ще не додано.',
}) {
  if (clubs.length === 0) {
    return <EmptyState title={emptyTitle} />
  }

  return (
    <ul className="club-grid">
      {clubs.map((club) => (
        <li key={club.id}>
          <ClubCard
            club={club}
            selected={club.id === selectedId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  )
}