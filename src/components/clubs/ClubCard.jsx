export default function ClubCard({ club }) {
    const status = club.currentBook
      ? `Зараз читають: ${club.currentBook}`
      : 'Книгу ще не обрано'
  
    return (
      <article className="club-card">
        <h3>{club.name}</h3>
        <p className="genre">{club.genre}</p>
        <p>{club.description}</p>
        <p className={club.currentBook ? 'status active' : 'status'}>
          {status}
        </p>
        <p className="members">Учасників: {club.membersCount}</p>
      </article>
    )
  }