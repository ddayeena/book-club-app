export const meetingStatuses = { upcoming: 'Заплановані', past: 'Минулі', cancelled: 'Скасовані' }
export function localDateTime(value) {
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export function localToInstant(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(value)
  // Reject invalid dates and nonexistent wall times during the spring DST jump.
  if (localDateTime(date) !== value) return null
  // An overlapping wall time has two possible instants. Do not silently choose one.
  for (const delta of [-120, -90, -60, -30, 30, 60, 90, 120]) {
    if (localDateTime(new Date(date.getTime() + delta * 60000)) === value) return null
  }
  return date.toISOString()
}
export function formatMeetingTime(value, timezone) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short', ...(timezone ? { timeZone: timezone } : {}) }).format(date)
}
export function validateMeeting(draft, original = null) {
  const errors = {}
  const trim = (v) => typeof v === 'string' ? v.trim() : ''
  const title = trim(draft.title), location = trim(draft.location), meetingUrl = trim(draft.meetingUrl), description = trim(draft.description)
  // Editing another field must not round seconds or reinterpret an existing DST overlap.
  const unchangedTime = Boolean(original?.startsAt) && draft.localTime === localDateTime(original.startsAt)
  const startsAt = unchangedTime ? original.startsAt : localToInstant(draft.localTime ?? '')
  if (title.length < 3 || title.length > 120) errors.title = 'Назва має містити від 3 до 120 символів.'
  if (!startsAt) errors.localTime = 'Вкажіть коректний, однозначний місцевий час. Уникайте години переходу на літній або зимовий час.'
  else if (new Date(startsAt).getTime() <= Date.now()) errors.localTime = 'Оберіть майбутній час.'
  if (!['online', 'offline', 'hybrid'].includes(draft.format)) errors.format = 'Оберіть формат.'
  if (location.length > 300 || (['offline', 'hybrid'].includes(draft.format) && !location)) errors.location = 'Вкажіть місце проведення, до 300 символів.'
  let safeUrl = !meetingUrl
  if (meetingUrl) {
    try { const url = new URL(meetingUrl); safeUrl = url.protocol === 'https:' && !url.username && !url.password && !/\s/.test(meetingUrl) && !meetingUrl.includes('\\') && !/\p{Cc}/u.test(meetingUrl) } catch { safeUrl = false }
  }
  if (!safeUrl || meetingUrl.length > 2048 || (['online', 'hybrid'].includes(draft.format) && !meetingUrl)) errors.meetingUrl = 'Вкажіть HTTPS-посилання без логіна й пароля.'
  if (description.length > 2000) errors.description = 'Опис — до 2000 символів.'
  return { ok: !Object.keys(errors).length, errors, value: { title, starts_at: startsAt, timezone: unchangedTime ? original.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone, format: draft.format, location: location || null, meeting_url: meetingUrl || null, description: description || null } }
}

