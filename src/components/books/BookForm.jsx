import { useState } from 'react'
import AppButton from '../ui/AppButton.jsx'
import FormField from '../ui/FormField.jsx'
import { validateBook } from '../../domain/bookValidation.js'

export default function BookForm({ book, busy, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => ({
    title: book?.title ?? '', author: book?.author ?? '', description: book?.description ?? '', coverUrl: book?.coverUrl ?? '',
  }))
  const [attempted, setAttempted] = useState(false)
  const validation = validateBook(draft, Boolean(book?.isMigrated))
  const errors = attempted ? validation.errors : {}
  const fields = [
    ['title', 'Назва книги', 200], ['author', 'Автор', 120],
    ['description', 'Опис (необов’язково)', 2000], ['coverUrl', 'HTTPS URL обкладинки (необов’язково)', 2048],
  ]
  function submit(event) {
    event.preventDefault()
    if (busy) return
    setAttempted(true)
    if (!validation.ok) {
      const field = fields.find(([name]) => validation.errors[name])?.[0]
      event.currentTarget.elements.namedItem(field)?.focus()
      return
    }
    void onSave(draft)
  }
  return <form noValidate onSubmit={submit} aria-label="Форма книги" className="book-editor">
    <h2>{book ? 'Редагувати книгу' : 'Додати книгу'}</h2>
    {book?.isMigrated && !book.author && <p className="field-hint">Назву перенесено зі старого клубу. Автора можна уточнити пізніше.</p>}
    <fieldset className="fieldset-plain" disabled={busy}>
      <legend className="visually-hidden">Дані книги</legend>
      {fields.map(([field, label, maxLength]) => {
        const id = 'book-' + field
        const props = { id, name: field, value: draft[field], maxLength,
          required: field === 'title' || (field === 'author' && !book?.isMigrated),
          onChange: (event) => setDraft((prev) => ({ ...prev, [field]: event.target.value })),
          'aria-invalid': Boolean(errors[field]), 'aria-describedby': errors[field] ? id + '-error' : undefined }
        return <FormField key={field} id={id} label={label} error={errors[field]}>
          {field === 'description' ? <textarea {...props} rows={4} /> : <input {...props} type={field === 'coverUrl' ? 'url' : 'text'} />}
        </FormField>
      })}
      <div className="form-actions"><AppButton type="submit">{busy ? 'Збереження…' : 'Зберегти книгу'}</AppButton>
        <AppButton variant="secondary" onClick={onCancel}>Скасувати</AppButton></div>
    </fieldset>
  </form>
}
