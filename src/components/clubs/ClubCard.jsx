import { useState } from 'react'
import ReadingStatusBadge from './ReadingStatusBadge.jsx'
import AppButton from '../ui/AppButton.jsx'

export default function ClubCard({ club, selected, onSelect }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const descriptionId = `club-${club.id}-description`

  return (
    <article className="club-card">
      <h3>{club.name}</h3>
      <p className="genre">{club.genre}</p>
      <p><ReadingStatusBadge currentBook={club.currentBook} /></p>

      <AppButton
        variant="secondary"
        aria-expanded={detailsOpen}
        aria-controls={descriptionId}
        onClick={() => setDetailsOpen((previous) => !previous)}
      >
        {detailsOpen ? 'Згорнути опис' : 'Показати опис'}
      </AppButton>
      <p id={descriptionId} hidden={!detailsOpen}>{club.description}</p>

      <p className="members">Учасників: {club.membersCount}</p>
      <p>
        <AppButton aria-pressed={selected} onClick={() => onSelect(club.id)}>
          Обрати «{club.name}»
        </AppButton>
      </p>
      {selected && <p className="selection-note">Обрано для заявки.</p>}
    </article>
  )
}