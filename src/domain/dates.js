// Дата зустрічі зберігається як рядок YYYY-MM-DD без часового поясу.
export function formatMeetingDate(isoDate) {
  const [year, month, day] = String(isoDate).split('-').map(Number)
  if (!year || !month || !day) return '—'
  return new Date(year, month - 1, day).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
  })
}

export function meetingParts(isoDate) {
  const [year, month, day] = String(isoDate).split('-').map(Number)
  if (!year || !month || !day) return { day: '—', month: '' }
  const date = new Date(year, month - 1, day)
  return {
    day: String(day),
    month: date.toLocaleDateString('uk-UA', { month: 'short' }).replace('.', ''),
  }
}

// Час створення заявки зберігається як ISO-рядок у UTC.
export function formatCreatedAt(isoDateTime) {
  const date = new Date(isoDateTime)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}