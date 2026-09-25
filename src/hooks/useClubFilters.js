import { useState } from 'react'

export default function useClubFilters(clubs) {
  const [query, setQuery] = useState('')
  const [readingOnly, setReadingOnly] = useState(false)
  const normalizedQuery = query.trim().toLocaleLowerCase('uk')
  const visibleClubs = clubs.filter((club) => (
    club.name.toLocaleLowerCase('uk').includes(normalizedQuery)
    && (!readingOnly || Boolean(club.currentBook))
  ))

  function resetFilters() {
    setQuery('')
    setReadingOnly(false)
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