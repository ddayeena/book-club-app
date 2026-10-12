import { useSearchParams } from 'react-router'
import {
  experienceOptions,
  isOption,
  participationOptions,
} from '../domain/options.js'
import { selectRequests } from '../domain/selectRequests.js'

export default function useRequestFilters(requests, clubs) {
  const [searchParams, setSearchParams] = useSearchParams()

  const query = searchParams.get('q') ?? ''
  const rawReminders = searchParams.get('reminders')
  const reminders = ['yes', 'no'].includes(rawReminders) ? rawReminders : 'all'
  const rawExperience = searchParams.get('experience')
  const experience = isOption(experienceOptions, rawExperience) ? rawExperience : 'all'
  const rawFormat = searchParams.get('format')
  const format = isOption(participationOptions, rawFormat) ? rawFormat : 'all'
  const rawClub = searchParams.get('club')
  const club = clubs.some((entry) => entry.id === rawClub) ? rawClub : 'all'
  const rawSort = searchParams.get('sort')
  const sort = ['hours-asc', 'hours-desc', 'newest'].includes(rawSort)
    ? rawSort
    : 'club'

  const visibleRequests = selectRequests(requests, clubs, {
    query, reminders, experience, format, club, sort,
  })

  function setParameter(name, value, defaultValue, replace = false) {
    const next = new URLSearchParams(searchParams)
    if (value === defaultValue) next.delete(name)
    else next.set(name, value)
    setSearchParams(next, { replace })
  }

  function resetFilters() {
    const next = new URLSearchParams(searchParams)
    for (const name of ['q', 'reminders', 'experience', 'format', 'club', 'sort']) {
      next.delete(name)
    }
    setSearchParams(next)
  }

  return {
    query, reminders, experience, format, club, sort, visibleRequests,
    setQuery: (value) => setParameter('q', value, '', true),
    setReminders: (value) => setParameter('reminders', value, 'all'),
    setExperience: (value) => setParameter('experience', value, 'all'),
    setFormat: (value) => setParameter('format', value, 'all'),
    setClub: (value) => setParameter('club', value, 'all'),
    setSort: (value) => setParameter('sort', value, 'club'),
    resetFilters,
  }
}