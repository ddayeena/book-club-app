import { useSearchParams } from 'react-router'

export default function useClubFilters(clubs) {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const readingOnly = searchParams.get('reading') === '1'
  const normalizedQuery = query.trim().toLocaleLowerCase('uk')
  const visibleClubs = clubs.filter((club) => (
    club.name.toLocaleLowerCase('uk').includes(normalizedQuery)
    && (!readingOnly || Boolean(club.currentBook))
  ))

  function setQuery(value) {
    const next = new URLSearchParams(searchParams)
    if (value === '') next.delete('q')
    else next.set('q', value)
    setSearchParams(next, { replace: true })
  }

  function setReadingOnly(value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('reading', '1')
    else next.delete('reading')
    setSearchParams(next)
  }

  function resetFilters() {
    const next = new URLSearchParams(searchParams)
    next.delete('q')
    next.delete('reading')
    setSearchParams(next)
  }

  return {
    query,
    setQuery,
    readingOnly,
    setReadingOnly,
    visibleClubs,
    resetFilters,
  }
}