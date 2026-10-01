import { useSearchParams } from 'react-router'

export default function useRequestFilters(requests, clubs) {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const rawReminders = searchParams.get('reminders')
  const reminders = ['yes', 'no'].includes(rawReminders) ? rawReminders : 'all'
  const rawSort = searchParams.get('sort')
  const sort = ['hours-asc', 'hours-desc'].includes(rawSort) ? rawSort : 'club'
  const names = new Map(clubs.map((club) => [club.id, club.name]))
  const normalizedQuery = query.trim().toLocaleLowerCase('uk')

  const visibleRequests = requests.filter((request) => {
    const text = `${names.get(request.clubId) ?? ''} ${request.motivation}`
      .toLocaleLowerCase('uk')
    const matchesReminders = reminders === 'all'
      || (reminders === 'yes' ? request.wantsReminders : !request.wantsReminders)
    return text.includes(normalizedQuery) && matchesReminders
  })

  visibleRequests.sort((a, b) => {
    let order = 0
    if (sort === 'hours-asc') order = a.weeklyHours - b.weeklyHours
    else if (sort === 'hours-desc') order = b.weeklyHours - a.weeklyHours
    else {
      order = (names.get(a.clubId) ?? '')
        .localeCompare(names.get(b.clubId) ?? '', 'uk')
    }
    return order || a.id.localeCompare(b.id)
  })

  function setParameter(name, value, defaultValue, replace = false) {
    const next = new URLSearchParams(searchParams)
    if (value === defaultValue) next.delete(name)
    else next.set(name, value)
    setSearchParams(next, { replace })
  }

  function resetFilters() {
    const next = new URLSearchParams(searchParams)
    next.delete('q')
    next.delete('reminders')
    next.delete('sort')
    setSearchParams(next)
  }

  return {
    query, reminders, sort, visibleRequests,
    setQuery: (value) => setParameter('q', value, '', true),
    setReminders: (value) => setParameter('reminders', value, 'all'),
    setSort: (value) => setParameter('sort', value, 'club'),
    resetFilters,
  }
}