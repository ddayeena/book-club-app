export default function CatalogStats({ clubs }) {
  const readingNow = clubs.filter((club) => club.currentBook).length
  const totalMembers = clubs.reduce((sum, club) => sum + club.membersCount, 0)
  const items = [
    { value: clubs.length, label: 'Клубів у каталозі' },
    { value: readingNow, label: 'Читають книгу зараз' },
    { value: totalMembers, label: 'Учасників разом' },
  ]

  return (
    <dl className="stat-strip">
      {items.map((item) => (
        <div key={item.label} className="stat">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
