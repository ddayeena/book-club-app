import AppButton from '../ui/AppButton.jsx'
import BookCover from './BookCover.jsx'
import { bookStatuses } from '../../domain/bookValidation.js'
import { formatCreatedAt } from '../../domain/dates.js'

export default function BookCard({ book, canManage, busy, onEdit, onStart, onComplete }) {
  return <article className={`book-card book-card-${book.status}`}>
    <BookCover url={book.coverUrl} title={book.title} />
    <div className="book-card-body">
      <div className="book-badges">
        <span className="book-status">{bookStatuses[book.status]}</span>
        {book.isNextSelected && <span className="book-status">Наступна обрана книга</span>}
        {book.isPollLocked && <span className="book-status">У голосуванні</span>}
      </div>
      {book.isPollLocked && <p className="field-hint">Книга бере участь у незавершеному голосуванні. Редагування й початок читання заблоковано.</p>}
      <h2>{book.title}</h2>
      <p className="book-author">{book.author || 'Автор не вказаний'}</p>
      {book.description && <p className="book-description">{book.description}</p>}
      {book.startedAt && <p className="field-hint">Початок читання: {formatCreatedAt(book.startedAt)}</p>}
      {book.completedAt && <p className="field-hint">Завершено: {formatCreatedAt(book.completedAt)}</p>}
      {canManage && <div className="form-actions">
        <AppButton variant="secondary" disabled={busy || book.isPollLocked} onClick={() => onEdit(book)}>Редагувати</AppButton>
        {book.status === 'planned' && <AppButton disabled={busy || book.isPollLocked} onClick={() => onStart(book)}>Почати читання</AppButton>}
        {book.status === 'current' && <AppButton disabled={busy} onClick={() => onComplete(book)}>Завершити читання</AppButton>}
      </div>}
    </div>
  </article>
}
