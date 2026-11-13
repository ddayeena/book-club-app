import { Link } from 'react-router'
import { genreColor } from '../../domain/genreColor.js'

// Полиця: кожен клуб це корінець книги. Висота залежить від кількості учасників.
export default function ClubShelf({ clubs }) {
  const shown = [...clubs]
    .sort((a, b) => b.membersCount - a.membersCount)
    .slice(0, 8)
  const largest = Math.max(1, ...shown.map((club) => club.membersCount))

  return (
    <nav className="shelf" aria-label="Клуби на полиці">
      <ul>
        {shown.map((club) => {
          const color = genreColor(club.genre)
          const height = 9 + Math.round((club.membersCount / largest) * 7)
          return (
            <li key={club.id}>
              <Link
                to={`/clubs/${encodeURIComponent(club.id)}`}
                className="spine"
                style={{ backgroundColor: color.spine, height: `${height}rem` }}
                title={`${club.name}: ${club.membersCount} учасників`}
              >
                <span>{club.name}</span>
              </Link>
            </li>
          )
        })}
      </ul>
      <div className="shelf-board" aria-hidden="true" />
    </nav>
  )
}
