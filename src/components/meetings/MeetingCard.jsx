import Link from '../navigation/ClubLink.jsx'
import { formatMeetingTime, meetingStatuses } from '../../domain/meetingValidation.js'
import { clubFormatOptions, optionLabel } from '../../domain/options.js'
export default function MeetingCard({ meeting }) {
  return <article className="meeting-card"><span className="meta-tag">{meetingStatuses[meeting.status]}</span>
    <h2><Link to={`/clubs/${meeting.clubId}/meetings/${meeting.id}`}>{meeting.title}</Link></h2>
    <p><time dateTime={meeting.startsAt}>{formatMeetingTime(meeting.startsAt)}</time></p>
    <p className="field-hint">{optionLabel(clubFormatOptions, meeting.format)} · Ваш часовий пояс: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
  </article>
}

