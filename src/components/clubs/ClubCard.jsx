import { useState } from 'react'
import { Link } from 'react-router'
import ReadingStatusBadge from './ReadingStatusBadge.jsx'
import AppButton from '../ui/AppButton.jsx'
import { clubFormatOptions, optionLabel } from '../../domain/options.js'
import { formatMeetingDate } from '../../domain/dates.js'

export default function ClubCard({ club, selected, onSelect }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const descriptionId = `club-${club.id}-description`

  return (
    <article className="club-card">
      <div className="club-card-top">
        <p className="genre">{club.genre}</p>
        <span className={`format-badge format-${club.format}`}>
          {optionLabel(clubFormatOptions, club.format)}
        </span>
      </div>

      <h3>
        <Link to={`/clubs/${encodeURIComponent(club.id)}`}>
          {club.name}
        </Link>
      </h3>
      <p><ReadingStatusBadge currentBook={club.currentBook} /></p>

      <ul className="club-meta">
        <li>
          <span aria-hidden="true">🗓</span>
          <span>Найближча зустріч: <strong>{formatMeetingDate(club.nextMeeting)}</strong></span>
        </li>
        <li>
          <span aria-hidden="true">🔁</span>
          <span>Зустрічей на місяць: <strong>{club.meetingsPerMonth}</strong></span>
        </li>
        <li>
          <span aria-hidden="true">🌐</span>
          <span>Мова: <strong>{club.language}</strong></span>
        </li>
        <li className="members">
          <span aria-hidden="true">👥</span>
          <span>Учасників: <strong>{club.membersCount}</strong></span>
        </li>
      </ul>

      <AppButton
        variant="secondary"
        aria-expanded={detailsOpen}
        aria-controls={descriptionId}
        onClick={() => setDetailsOpen((previous) => !previous)}
      >
        {detailsOpen ? 'Згорнути опис' : 'Показати опис'}
      </AppButton>
      <p id={descriptionId} hidden={!detailsOpen}>{club.description}</p>

      <p>
        <AppButton aria-pressed={selected} onClick={() => onSelect(club.id)}>
          Обрати «{club.name}»
        </AppButton>
      </p>
      {selected && <p className="selection-note">Обрано для заявки.</p>}
    </article>
  )
}