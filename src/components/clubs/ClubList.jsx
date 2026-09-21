import ClubCard from './ClubCard.jsx'
import EmptyState from '../ui/EmptyState.jsx'

export default function ClubList({ clubs }) {
  if (clubs.length === 0) {
    return (
      <EmptyState title="Клубів ще не додано.">
        <p>Після наповнення каталогу тут з'являться картки клубів.</p>
      </EmptyState>
    )
  }

  return (
    <ul className="club-grid">
      {clubs.map((club) => (
        <li key={club.id}>
          <ClubCard club={club} />
        </li>
      ))}
    </ul>
  )
}