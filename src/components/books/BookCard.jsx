import AppButton from '../ui/AppButton.jsx'
import BookCover from './BookCover.jsx'
import { bookStatuses } from '../../domain/bookValidation.js'
import { formatCreatedAt } from '../../domain/dates.js'

export default function BookCard({ book, canManage, busy, onEdit, onStart, onComplete }) {
  return <article className={`book-card book-card-${book.status}`}>
    <BookCover url={book.coverUrl} title={book.title} />
    <div className="book-card-body">
      <span className="book-status">{bookStatuses[book.status]}</span>
      <h2>{book.title}</h2>
      <p className="book-author">{book.author || 'Автор не вказаний'}</p>
      {book.description && <p className="book-description">{book.description}</p>}
      {book.startedAt && <p className="field-hint">Початок читання: {formatCreatedAt(book.startedAt)}</p>}
      {book.completedAt && <p className="field-hint">Завершено: {formatCreatedAt(book.completedAt)}</p>}
      {canManage && <div className="form-actions">
        <AppButton variant="secondary" disabled={busy} onClick={() => onEdit(book)}>Редагувати</AppButton>
        {book.status === 'planned' && <AppButton disabled={busy} onClick={() => onStart(book)}>Почати читання</AppButton>}
        {book.status === 'current' && <AppButton disabled={busy} onClick={() => onComplete(book)}>Завершити читання</AppButton>}
      </div>}
    </div>
  </article>
}
