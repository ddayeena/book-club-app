import { useState } from 'react'
import FormField from '../ui/FormField.jsx'
import AppButton from '../ui/AppButton.jsx'
import { validateDiscussion } from '../../domain/discussionValidation.js'
import { bookStatuses } from '../../domain/bookValidation.js'

export default function DiscussionForm({ topic, books, busy, onSave }) {
  const [draft, setDraft] = useState({ title: topic?.title ?? '', body: topic?.body ?? '', bookId: topic?.book_id ?? '' })
  const [errors, setErrors] = useState({})
  function submit(e) {
    e.preventDefault()
    if (busy) return
    const result = validateDiscussion(draft)
    setErrors(result.errors)
    if (result.ok) void onSave(draft)
    else e.currentTarget.querySelector(result.errors.title ? '#discussion-title' : '#discussion-body')?.focus()
  }
  return <form className="discussion-form" onSubmit={submit} aria-label="Форма теми">
    <FormField id="discussion-title" label="Назва теми" error={errors.title}><input id="discussion-title" value={draft.title} disabled={busy} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'discussion-title-error' : undefined} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></FormField>
    <FormField id="discussion-book" label="Книга (необов’язково)"><select id="discussion-book" value={draft.bookId} disabled={busy} onChange={(e) => setDraft({ ...draft, bookId: e.target.value })}><option value="">Загальна тема клубу</option>{books.map((b) => <option key={b.id} value={b.id}>{b.title} · {bookStatuses[b.status]}</option>)}</select></FormField>
    <FormField id="discussion-body" label="Текст теми" error={errors.body}><textarea id="discussion-body" rows={10} value={draft.body} disabled={busy} aria-invalid={Boolean(errors.body)} aria-describedby={errors.body ? 'discussion-body-error' : undefined} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></FormField>
    <AppButton type="submit" disabled={busy}>{busy ? 'Збереження…' : 'Зберегти тему'}</AppButton>
  </form>
}
