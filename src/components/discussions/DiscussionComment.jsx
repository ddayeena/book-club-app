import { useRef, useState } from 'react'
import AppButton from '../ui/AppButton.jsx'
import CommentForm from './CommentForm.jsx'

export default function DiscussionComment({ comment, busy, onSave, onDelete }) {
  const [editing, setEditing] = useState(false), trigger = useRef(null)
  function close() { setEditing(false); trigger.current?.querySelector('button')?.focus() }
  return <article className="discussion-comment" aria-label={comment.deleted_at ? 'Коментар видалено' : `Коментар: ${comment.author_name}`}>
    {comment.deleted_at ? <p className="field-hint">Коментар видалено</p> : <>
      <p className="field-hint"><strong>{comment.author_name}</strong> · <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString('uk-UA')}</time>{comment.updated_at !== comment.created_at && ' · відредаговано'}</p>
      {editing ? <CommentForm comment={comment} busy={busy} onCancel={close} onSave={async (draft) => { const ok = await onSave(draft, comment); if (ok) setEditing(false); return ok }} /> : <p className="discussion-text">{comment.body}</p>}
      <div className="form-actions" ref={trigger}>{comment.can_edit && !editing && <AppButton variant="secondary" disabled={busy} onClick={() => setEditing(true)}>Редагувати коментар</AppButton>}{comment.can_delete && <AppButton variant="danger" disabled={busy} onClick={(e) => onDelete(comment, e.currentTarget)}>Видалити коментар</AppButton>}</div>
    </>}
  </article>
}
