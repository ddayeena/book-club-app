import { useState } from 'react'
import FormField from '../ui/FormField.jsx'
import AppButton from '../ui/AppButton.jsx'
import { validateDiscussion } from '../../domain/discussionValidation.js'

export default function CommentForm({ comment, busy, onSave, onCancel }) {
  const [body, setBody] = useState(comment?.body ?? ''), [error, setError] = useState('')
  const id = `comment-body-${comment?.id ?? 'new'}`
  async function submit(e) {
    e.preventDefault()
    if (busy) return
    const result = validateDiscussion({ body }, true)
    setError(result.errors.body ?? '')
    if (!result.ok) { e.currentTarget.querySelector('textarea')?.focus(); return }
    if (await onSave({ body })) setBody('')
  }
  return <form onSubmit={(e) => void submit(e)} className="discussion-form" aria-label={comment ? 'Редагування коментаря' : 'Новий коментар'}>
    <FormField id={id} label={comment ? 'Текст коментаря' : 'Ваш коментар'} error={error}><textarea id={id} rows={4} value={body} autoFocus={Boolean(comment)} disabled={busy} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(e) => setBody(e.target.value)} /></FormField>
    <div className="form-actions"><AppButton type="submit" disabled={busy}>{busy ? 'Збереження…' : comment ? 'Зберегти коментар' : 'Додати коментар'}</AppButton>{onCancel && <AppButton variant="secondary" disabled={busy} onClick={onCancel}>Скасувати редагування</AppButton>}</div>
  </form>
}
