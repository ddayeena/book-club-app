export function selectRequests(requests, clubs, filters) {
  const {
    query = '',
    reminders = 'all',
    experience = 'all',
    format = 'all',
    club = 'all',
    sort = 'club',
  } = filters
  const names = new Map(clubs.map((entry) => [entry.id, entry.name]))
  const normalizedQuery = query.trim().toLocaleLowerCase('uk')

  const selected = requests.filter((request) => {
    const text = `${names.get(request.clubId) ?? ''} ${request.motivation}`
      .toLocaleLowerCase('uk')
    const matchesReminders = reminders === 'all'
      || (reminders === 'yes' ? request.wantsReminders : !request.wantsReminders)

    return text.includes(normalizedQuery)
      && matchesReminders
      && (experience === 'all' || request.experience === experience)
      && (format === 'all' || request.participationFormat === format)
      && (club === 'all' || request.clubId === club)
  })

  return selected.sort((a, b) => {
    let order
    if (sort === 'hours-asc') order = a.weeklyHours - b.weeklyHours
    else if (sort === 'hours-desc') order = b.weeklyHours - a.weeklyHours
    else if (sort === 'newest') order = b.createdAt.localeCompare(a.createdAt)
    else {
      order = (names.get(a.clubId) ?? '')
        .localeCompare(names.get(b.clubId) ?? '', 'uk')
    }
    return order || a.id.localeCompare(b.id)
  })
}