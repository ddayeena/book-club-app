import { useState } from 'react'
import Link from '../navigation/ClubLink.jsx'
import ReadingStatusBadge from './ReadingStatusBadge.jsx'
import AppButton from '../ui/AppButton.jsx'
import GenreTag from '../ui/GenreTag.jsx'
import { clubFormatOptions, optionLabel } from '../../domain/options.js'
import { formatMeetingDate } from '../../domain/dates.js'
import { genreColor } from '../../domain/genreColor.js'
import { formatMeetingTime } from '../../domain/meetingValidation.js'

export default function ClubCard({ club, selected, onSelect, isOwn = false, showSelection = true }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const descriptionId = `club-${club.id}-description`
  const color = genreColor(club.genre)

  return (
    <article className={selected ? 'club-row is-selected' : 'club-row'}>
      <span
        className="club-spine"
        style={{ backgroundColor: color.spine }}
        aria-hidden="true"
      />

      <div className="club-row-main">
        <div className="club-row-tags">
          <GenreTag genre={club.genre} />
          <span className="meta-tag">{optionLabel(clubFormatOptions, club.format)}</span>
          {isOwn && <span className="own-tag">Ваш клуб</span>}
        </div>

        <h3>
          <Link to={`/clubs/${encodeURIComponent(club.id)}`}>{club.name}</Link>
        </h3>
        <p className="club-row-reading">
          <ReadingStatusBadge currentBook={club.currentBook} />
        </p>
        {club.legacyNextMeeting && <p className="field-hint">Дата зі старого розкладу — час не уточнено: {formatMeetingDate(club.legacyNextMeeting)}</p>}

        <dl className="club-facts">
          <div>
            <dt>Найближча зустріч</dt>
            <dd>{club.nextMeetingAt ? formatMeetingTime(club.nextMeetingAt) : formatMeetingDate(club.nextMeeting)}</dd>
          </div>
          <div>
            <dt>Зустрічей на місяць</dt>
            <dd>{club.meetingsPerMonth}</dd>
          </div>
          <div>
            <dt>Мова</dt>
            <dd>{club.language}</dd>
          </div>
          <div>
            <dt>Учасників</dt>
            <dd>{Number.isSafeInteger(club.membersCount) && club.membersCount >= 0 ? club.membersCount : '—'}</dd>
          </div>
        </dl>

        <p id={descriptionId} className="club-row-description" hidden={!detailsOpen}>
          {club.description}
        </p>
      </div>

      <div className="club-row-actions">
        <AppButton
          variant="ghost"
          aria-expanded={detailsOpen}
          aria-controls={descriptionId}
          onClick={() => setDetailsOpen((previous) => !previous)}
        >
          {detailsOpen ? 'Згорнути опис' : 'Показати опис'}
        </AppButton>
        {showSelection && <AppButton variant="secondary" aria-pressed={selected} onClick={() => onSelect(club.id)}>
          Обрати «{club.name}»
        </AppButton>}
        {showSelection && selected && <p className="selection-note">Обрано для заявки.</p>}
      </div>
    </article>
  )
}
