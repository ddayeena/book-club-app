import ReadingStatusBadge from './ReadingStatusBadge.jsx'

export default function ClubCard({ club }) {
  return (
    <article className="club-card">
      <h3>{club.name}</h3>
      <p className="genre">{club.genre}</p>
      <p>{club.description}</p>
      <p><ReadingStatusBadge currentBook={club.currentBook} /></p>
      <p className="members">Учасників: {club.membersCount}</p>
    </article>
  )
}