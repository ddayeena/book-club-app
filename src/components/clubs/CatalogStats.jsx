export default function CatalogStats({ clubs }) {
  const readingNow = clubs.filter((club) => club.currentBook).length
  const totalMembers = clubs.reduce((sum, club) => sum + club.membersCount, 0)

  return (
    <div className="catalog-stats">
      <div className="stat-card">
        <span className="stat-number">{clubs.length}</span>
        <span className="stat-label">Клубів у каталозі</span>
      </div>
      <div className="stat-card">
        <span className="stat-number">{readingNow}</span>
        <span className="stat-label">Читають книгу зараз</span>
      </div>
      <div className="stat-card">
        <span className="stat-number">{totalMembers}</span>
        <span className="stat-label">Учасників разом</span>
      </div>
    </div>
  )
}