import { useState } from 'react'
import FormField from '../ui/FormField.jsx'
import AppButton from '../ui/AppButton.jsx'
import { localDateTime, validateMeeting, formatMeetingTime } from '../../domain/meetingValidation.js'
import { clubFormatOptions } from '../../domain/options.js'

export default function MeetingForm({ meeting, busy, onSave }) {
  const [draft, setDraft] = useState(() => ({ title: meeting?.title ?? '', localTime: meeting ? localDateTime(meeting.startsAt) : '',
    format: meeting?.format ?? 'online', location: meeting?.location ?? '', meetingUrl: meeting?.meetingUrl ?? '', description: meeting?.description ?? '' }))
  const [attempted, setAttempted] = useState(false)
  const result = validateMeeting(draft, meeting)
  function bind(field) { return { id: 'meeting-' + field, name: field, value: draft[field], onChange: (e) => setDraft((v) => ({ ...v, [field]: e.target.value })),
    'aria-invalid': attempted && Boolean(result.errors[field]), 'aria-describedby': attempted && result.errors[field] ? 'meeting-' + field + '-error' : undefined } }
  const field = (key, label, control) => <FormField id={'meeting-' + key} label={label} error={attempted ? result.errors[key] : ''}>{control}</FormField>
  return <form className="meeting-form profile-card" aria-label="Форма зустрічі" noValidate onSubmit={(e) => {
    e.preventDefault(); setAttempted(true)
    if (!result.ok) { e.currentTarget.elements.namedItem(Object.keys(result.errors)[0])?.focus(); return }
    if (!busy) void onSave(draft)
  }}><fieldset className="fieldset-plain" disabled={busy}><legend className="visually-hidden">Дані зустрічі</legend>
    {field('title', 'Назва зустрічі', <input required maxLength={120} {...bind('title')} />)}
    {field('localTime', 'Дата й час', <input type="datetime-local" required {...bind('localTime')} />)}
    <p className="field-hint">Часовий пояс браузера: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Час із неоднозначної години переведення годинника потрібно змінити.</p>
    {result.value.starts_at && <p className="field-hint">Попередній перегляд: {formatMeetingTime(result.value.starts_at)} · UTC: {result.value.starts_at}</p>}
    {field('format', 'Формат', <select {...bind('format')}>{clubFormatOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>)}
    {field('location', 'Місце проведення', <input maxLength={300} required={draft.format !== 'online'} {...bind('location')} />)}
    {field('meetingUrl', 'Посилання на зустріч', <input type="url" maxLength={2048} required={draft.format !== 'offline'} {...bind('meetingUrl')} />)}
    {field('description', 'Опис (необов’язково)', <textarea rows={4} maxLength={2000} {...bind('description')} />)}
    <AppButton type="submit">{busy ? 'Збереження…' : 'Зберегти зустріч'}</AppButton>
  </fieldset></form>
}

