import { memberCount, memberRangeOptions, meetingInstant, normalizeGenre, normalizeLanguage } from './catalogFilters.js'

export function selectClubs(clubs, filters) {
  const {
    query = '',
    readingOnly = false,
    format = 'all',
    genre = 'all',
    ownerId = null,
    sort = 'name',
    language = 'all',
    members = 'all',
    meetingOnly = false,
    now = Date.now(),
  } = filters
  const normalizedQuery = query.trim().toLocaleLowerCase('uk')
  const range = memberRangeOptions.find((entry) => entry.value === members)

  const selected = clubs.filter((club) => {
    const text = `${club.name} ${club.genre} ${club.currentBook ?? ''}`
      .toLocaleLowerCase('uk')

    return text.includes(normalizedQuery)
      && (!readingOnly || Boolean(club.currentBook))
      && (format === 'all' || club.format === format)
      && (genre === 'all' || normalizeGenre(club.genre) === normalizeGenre(genre))
      && (ownerId === null || club.ownerId === ownerId)
      && (language === 'all' || normalizeLanguage(club.language) === normalizeLanguage(language))
      && (!range || (memberCount(club.membersCount) !== null && club.membersCount >= range.min && club.membersCount <= range.max))
      && (!meetingOnly || meetingInstant(club.nextMeetingAt) > now)
  })

  return selected.sort((a, b) => {
    let order
    if (sort === 'members-desc') {
      const aCount = memberCount(a.membersCount), bCount = memberCount(b.membersCount)
      order = Number(aCount === null) - Number(bCount === null) || (aCount !== null && bCount !== null ? bCount - aCount : 0)
    }
    else if (sort === 'meeting-asc') {
      const aTime = a.nextMeetingAt ?? a.nextMeeting
      const bTime = b.nextMeetingAt ?? b.nextMeeting
      order = Number(!aTime) - Number(!bTime)
        || (aTime && bTime ? Date.parse(aTime) - Date.parse(bTime) : 0)
    }
    else order = a.name.localeCompare(b.name, 'uk')
    return order || a.id.localeCompare(b.id)
  })
}
