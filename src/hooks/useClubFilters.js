import { useSearchParams } from 'react-router'
import { clubFormatOptions, isOption } from '../domain/options.js'
import { selectClubs } from '../domain/selectClubs.js'
import useAuth from './useAuth.js'

export default function useClubFilters(clubs) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const genres = [...new Set(clubs.map((club) => club.genre))]
    .sort((a, b) => a.localeCompare(b, 'uk'))

  const query = searchParams.get('q') ?? ''
  const readingOnly = searchParams.get('reading') === '1'
  const rawFormat = searchParams.get('format')
  const format = isOption(clubFormatOptions, rawFormat) ? rawFormat : 'all'
  const rawGenre = searchParams.get('genre')
  const genre = genres.includes(rawGenre) ? rawGenre : 'all'
  const mine = Boolean(user) && searchParams.get('mine') === '1'
  const rawSort = searchParams.get('sort')
  const sort = ['members-desc', 'meeting-asc'].includes(rawSort) ? rawSort : 'name'

  const visibleClubs = selectClubs(clubs, {
    query, readingOnly, format, genre, sort, ownerId: mine ? user.id : null,
  })

  function setParameter(name, value, defaultValue, replace = false) {
    const next = new URLSearchParams(searchParams)
    if (value === defaultValue) next.delete(name)
    else next.set(name, value)
    setSearchParams(next, { replace })
  }

  function resetFilters() {
    const next = new URLSearchParams(searchParams)
    for (const name of ['q', 'reading', 'format', 'genre', 'mine', 'sort']) next.delete(name)
    setSearchParams(next)
  }

  return {
    query,
    readingOnly,
    format,
    genre,
    sort,
    mine,
    genres,
    visibleClubs,
    setQuery: (value) => setParameter('q', value, '', true),
    setReadingOnly: (value) => setParameter('reading', value ? '1' : '', ''),
    setFormat: (value) => setParameter('format', value, 'all'),
    setGenre: (value) => setParameter('genre', value, 'all'),
    setMine: (value) => setParameter('mine', value ? '1' : '', ''),
    setSort: (value) => setParameter('sort', value, 'name'),
    resetFilters,
  }
}