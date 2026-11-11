import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import BookCard from '../components/books/BookCard.jsx'
import BookForm from '../components/books/BookForm.jsx'
import { bookService } from '../services/bookService.js'
import { bookStatuses } from '../domain/bookValidation.js'
import { errorMessage } from '../services/ServiceError.js'
import NotFoundPage from './NotFoundPage.jsx'

function Bookshelf({ club }) {
  const { user } = useAuth()
  const { reload } = useClubs()
  const [params, setParams] = useSearchParams()
  const rawFilter = params.get('status')
  const filter = Object.hasOwn(bookStatuses, rawFilter) ? rawFilter : 'all'
  const [books, setBooks] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [editor, setEditor] = useState(null)
  const [replacement, setReplacement] = useState(null)
  const [previousAction, setPreviousAction] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const alive = useRef(false)
  const read = useRef(null)
  const canManage = user?.id === club.ownerId && !club.archivedAt
  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    read.current = controller
    bookService.getAll(club.id, { signal: controller.signal }).then(
      (records) => { if (!controller.signal.aborted) { setBooks(records); setStatus('success') } },
      (cause) => { if (!controller.signal.aborted) { setError(errorMessage(cause)); setStatus('error') } },
    )
    return () => { alive.current = false; controller.abort() }
  }, [club.id, attempt])
  function refresh() {
    if (lock.current) return
    setEditor(null); setReplacement(null)
    setError(''); setStatus('loading'); setAttempt((n) => n + 1)
  }
  async function run(operation, message) {
    if (!canManage || lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    read.current?.abort()
    try {
      await operation()
      if (!alive.current) return
      setEditor(null); setReplacement(null); setNotice(message)
      try {
        const [records] = await Promise.all([bookService.getAll(club.id), reload(true)])
        if (alive.current) { setBooks(records); setStatus('success') }
      } catch {
        if (alive.current) { setError('Зміну збережено. Не вдалося оновити полицю — повторіть завантаження.'); setStatus('error') }
      }
    } catch (cause) { if (alive.current) setError(errorMessage(cause)) }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  function start(book) {
    if (lock.current || book.isPollLocked) return
    const previous = books.find((entry) => entry.status === 'current')
    if (previous) { setPreviousAction(''); setReplacement({ book, previous }); return }
    if (window.confirm(`Почати читання «${book.title}»?`))
      void run(() => bookService.start(book.id), 'Читання розпочато.')
  }
  function complete(book) {
    if (window.confirm(`Завершити читання «${book.title}»?`))
      void run(() => bookService.complete(book.id), 'Книгу додано до прочитаних.')
  }
  function setFilter(value) {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('status')
    else next.set('status', value)
    setParams(next)
  }
  const visible = books.filter((book) => filter === 'all' || book.status === filter)
  return <>
    <p className="breadcrumb"><Link to={`/clubs/${club.id}`}>{club.name}</Link> / Книги</p>
    <PageHeading title={`Книжкова полиця: ${club.name}`} />
    <p className="page-lead">Що читаємо зараз, що плануємо й що вже обговорили.</p>
    {club.archivedAt && <p className="flash">Клуб архівовано. Полиця доступна лише для перегляду історії.</p>}
    {notice && <p role="status" className="flash">{notice}</p>}
    {error && <p role="alert" className="form-alert">{error}</p>}
    <div className="page-toolbar">
      {user && <Link to={`/clubs/${club.id}/polls`} className="link-button link-button-secondary">Голосування за книги</Link>}
      {canManage && <AppButton disabled={busy || status !== 'success'} onClick={() => { setEditor({ book: null }); setReplacement(null); setError('') }}>Додати книгу</AppButton>}
      <AppButton variant="secondary" disabled={busy} onClick={refresh}>Оновити полицю</AppButton>
    </div>
    <div className="chip-group book-filters" role="group" aria-label="Статус книг">
      {[['all', 'Усі книги'], ...Object.entries(bookStatuses)].map(([value, label]) =>
        <button key={value} type="button" className="chip" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
    </div>
    {status === 'loading' && <p role="status">Завантаження книг…</p>}
    {status === 'error' && <AppButton variant="secondary" disabled={busy} onClick={refresh}>Спробувати ще раз</AppButton>}
    {canManage && editor && <BookForm key={editor.book?.id ?? 'new'} book={editor.book} busy={busy}
      onSave={(draft) => run(() => bookService.save(club.id, draft, editor.book), 'Книгу збережено до полиці.')}
      onCancel={() => { if (!busy) setEditor(null) }} />}
    {canManage && replacement && <section className="book-replacement" aria-labelledby="replacement-title">
      <h2 id="replacement-title">Що зробити з поточною книгою?</h2>
      <p>Зараз читаємо «{replacement.previous.title}». Наступне читання — «{replacement.book.title}».</p>
      <fieldset disabled={busy}>
        <legend>Дія для попередньої книги</legend>
        {[['completed', 'Позначити як прочитану'], ['planned', 'Повернути до запланованих']].map(([value, label]) =>
          <label className="checkbox-field" key={value}><input type="radio" name="previous-action" value={value}
            checked={previousAction === value} onChange={() => setPreviousAction(value)} />{label}</label>)}
      </fieldset>
      <div className="form-actions">
        <AppButton disabled={busy || !previousAction} onClick={() => void run(
          () => bookService.start(replacement.book.id, replacement.previous.id, previousAction), 'Поточну книгу змінено.',
        )}>Підтвердити заміну</AppButton>
        <AppButton variant="secondary" disabled={busy} onClick={() => setReplacement(null)}>Скасувати заміну</AppButton>
      </div>
    </section>}
    {status === 'success' && (visible.length ? <ul className="book-grid">{visible.map((book) => <li key={book.id}>
      <BookCard book={book} canManage={canManage} busy={busy}
        onEdit={(value) => { setEditor({ book: value }); setReplacement(null); setError('') }}
        onStart={start} onComplete={complete} />
    </li>)}</ul> : <EmptyState title={books.length ? 'Книг із цим статусом ще немає.' : 'Полиця поки порожня.'}>
      {canManage && <p>Додайте першу книгу, щоб почати читання разом.</p>}
    </EmptyState>)}
  </>
}
export default function ClubBooksPage() {
  const { clubId } = useParams()
  const { clubs } = useClubs()
  const { user } = useAuth()
  const club = clubs.find((entry) => entry.id === clubId)
  if (!club) return <NotFoundPage title="Клуб не знайдено" />
  return <Bookshelf key={clubId + (user?.id ?? 'guest')} club={club} />
}
