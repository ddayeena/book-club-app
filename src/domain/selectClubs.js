export function selectClubs(clubs, filters) {
  const {
    query = '',
    readingOnly = false,
    format = 'all',
    genre = 'all',
    ownerId = null,
    sort = 'name',
  } = filters
  const normalizedQuery = query.trim().toLocaleLowerCase('uk')

  const selected = clubs.filter((club) => {
    const text = `${club.name} ${club.genre} ${club.currentBook ?? ''}`
      .toLocaleLowerCase('uk')

    return text.includes(normalizedQuery)
      && (!readingOnly || Boolean(club.currentBook))
      && (format === 'all' || club.format === format)
      && (genre === 'all' || club.genre === genre)
      && (ownerId === null || club.ownerId === ownerId)
  })

  return selected.sort((a, b) => {
    let order
    if (sort === 'members-desc') order = b.membersCount - a.membersCount
    else if (sort === 'meeting-asc') order = a.nextMeeting.localeCompare(b.nextMeeting)
    else order = a.name.localeCompare(b.name, 'uk')
    return order || a.id.localeCompare(b.id)
  })
}