import { useState } from 'react'
import AppButton from '../ui/AppButton.jsx'
import FormField from '../ui/FormField.jsx'
import { validatePoll } from '../../domain/pollValidation.js'

export default function PollForm({ books, busy, onSave }) {
  const [draft, setDraft] = useState({ title: '', endsAt: '', bookIds: [] })
  const [attempted, setAttempted] = useState(false)
  const validation = validatePoll(draft)
  const errors = attempted ? validation.errors : {}
  function change(field, value) { setDraft((old) => ({ ...old, [field]: value })) }
  return <form className="book-editor" aria-label="Нове голосування" noValidate onSubmit={(e) => {
    e.preventDefault(); setAttempted(true)
    if (!busy && validation.ok) void onSave(draft)
  }}>
    <h2>Створити голосування</h2>
    <fieldset disabled={busy} className="fieldset-plain">
      <legend className="visually-hidden">Параметри голосування</legend>
      <FormField id="poll-title" label="Назва голосування" error={errors.title}>
        <input id="poll-title" value={draft.title} maxLength={120} required aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'poll-title-error' : undefined} onChange={(e) => change('title', e.target.value)} />
      </FormField>
      <FormField id="poll-ends" label="Завершення голосування" error={errors.endsAt} hint="Ваш місцевий час. Остаточний строк перевіряє сервер.">
        <input id="poll-ends" type="datetime-local" required value={draft.endsAt} aria-invalid={Boolean(errors.endsAt)}
          aria-describedby={`poll-ends-hint${errors.endsAt ? ' poll-ends-error' : ''}`} onChange={(e) => change('endsAt', e.target.value)} />
      </FormField>
      <fieldset className="poll-options" aria-describedby={errors.bookIds ? 'poll-books-error' : undefined}>
        <legend>Оберіть щонайменше дві заплановані книги</legend>
        {books.map((book) => <label key={book.id} className="checkbox-field"><input type="checkbox"
          checked={draft.bookIds.includes(book.id)} onChange={(e) => change('bookIds', e.target.checked
            ? [...draft.bookIds, book.id] : draft.bookIds.filter((id) => id !== book.id))} />
          {book.title} — {book.author || 'Автор не вказаний'}</label>)}
      </fieldset>
      {errors.bookIds && <p id="poll-books-error" className="field-error">{errors.bookIds}</p>}
      <p className="field-hint">До фіксації результату або скасування ці книги не можна буде редагувати чи починати читати.</p>
      <AppButton type="submit">{busy ? 'Створення…' : 'Створити голосування'}</AppButton>
    </fieldset>
  </form>
}
