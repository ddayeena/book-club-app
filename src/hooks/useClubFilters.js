import { useEffect, useReducer } from 'react'
import { useSearchParams } from 'react-router'
import { clubFormatOptions, isOption } from '../domain/options.js'
import { selectClubs } from '../domain/selectClubs.js'
import useAuth from './useAuth.js'
import { catalogGenres, meetingInstant, memberRangeOptions, normalizeGenre, normalizeLanguage } from '../domain/catalogFilters.js'

export default function useClubFilters(clubs) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const genres = catalogGenres(clubs)

  const query = searchParams.get('q') ?? ''
  const readingOnly = searchParams.get('reading') === '1'
  const rawFormat = searchParams.get('format')
  const format = isOption(clubFormatOptions, rawFormat) ? rawFormat : 'all'
  const rawGenre = searchParams.get('genre')
  const genre = genres.find((entry) => normalizeGenre(entry) === normalizeGenre(rawGenre)) ?? 'all'
  const language = normalizeLanguage(searchParams.get('language')) ?? 'all'
  const rawMembers = searchParams.get('members')
  const members = memberRangeOptions.some((entry) => entry.value === rawMembers) ? rawMembers : 'all'
  const meetingOnly = searchParams.get('meeting') === '1'
  const [now, tick] = useReducer(() => Date.now(), null, () => Date.now())
  const nextMeeting = meetingOnly ? Math.min(...clubs.map((club) => meetingInstant(club.nextMeetingAt)).filter((time) => time > now)) : Infinity
  useEffect(() => {
    if (!meetingOnly) return
    const timer = Number.isFinite(nextMeeting) ? setTimeout(tick, Math.min(Math.max(0, nextMeeting - Date.now()), 2147483647)) : null
    const refresh = () => { if (document.visibilityState !== 'hidden') tick() }
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh)
    return () => { clearTimeout(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [meetingOnly, nextMeeting, now])
  const mine = Boolean(user) && searchParams.get('mine') === '1'
  const rawSort = searchParams.get('sort')
  const sort = ['members-desc', 'meeting-asc'].includes(rawSort) ? rawSort : 'name'

  const visibleClubs = selectClubs(clubs, {
    query, readingOnly, format, genre, sort, ownerId: mine ? user.id : null, language, members, meetingOnly, now,
  })

  function setParameter(name, value, defaultValue, replace = false) {
    tick()
    const next = new URLSearchParams(searchParams)
    if (value === defaultValue) next.delete(name)
    else next.set(name, value)
    setSearchParams(next, { replace })
  }

  function resetFilters() {
    const next = new URLSearchParams(searchParams)
    for (const name of ['q', 'reading', 'format', 'genre', 'mine', 'sort', 'language', 'members', 'meeting']) next.delete(name)
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
    language, members, meetingOnly,
    visibleClubs,
    setQuery: (value) => setParameter('q', value, '', true),
    setReadingOnly: (value) => setParameter('reading', value ? '1' : '', ''),
    setFormat: (value) => setParameter('format', value, 'all'),
    setGenre: (value) => setParameter('genre', value, 'all'),
    setMine: (value) => setParameter('mine', value ? '1' : '', ''),
    setSort: (value) => setParameter('sort', value, 'name'),
    setLanguage: (value) => setParameter('language', value, 'all'),
    setMembers: (value) => setParameter('members', value, 'all'),
    setMeetingOnly: (value) => setParameter('meeting', value ? '1' : '', ''),
    resetFilters,
  }
}
