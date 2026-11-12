import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import DiscussionScope from '../components/discussions/DiscussionScope.jsx'
import DiscussionComment from '../components/discussions/DiscussionComment.jsx'
import CommentForm from '../components/discussions/CommentForm.jsx'
import DiscussionPagination from '../components/discussions/DiscussionPagination.jsx'
import AdminConfirmation from '../components/admin/AdminConfirmation.jsx'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import useDiscussionResource from '../hooks/useDiscussionResource.js'
import useAuth from '../hooks/useAuth.js'
import { discussionService } from '../services/discussionService.js'
import { errorMessage } from '../services/ServiceError.js'

function Details({ club, topicId }) {
  const [params, setParams] = useSearchParams(), { search } = useLocation(), { refreshAccess } = useAuth()
  const raw = Number(params.get('comments') ?? 1), page = Number.isInteger(raw) && raw > 0 && raw <= 1000000 ? raw : 1
  const { data, error, reload } = useDiscussionResource('details', club.id, topicId, page)
  const [busy, setBusy] = useState(false), [failure, setFailure] = useState(''), [notice, setNotice] = useState(''), [confirm, setConfirm] = useState(null)
  const lock = useRef(false), alive = useRef(false), heading = useRef(null), trigger = useRef(null)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  async function perform(action, message) {
    if (lock.current) return false
    lock.current = true; setBusy(true); setFailure(''); setNotice('')
    try {
      await action()
      if (!alive.current) return false
      setConfirm(null); setNotice(message); heading.current?.focus(); reload(); return true
    } catch (cause) { if (alive.current) { setFailure(errorMessage(cause)); if (cause.code === '42501') void refreshAccess() } return false }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  function dismiss() { if (!lock.current) { setConfirm(null); trigger.current?.focus() } }
  function ask(comment, element) { trigger.current = element; setConfirm({ comment, topic: data.topic }) }
  const topic = data?.topic
  return <div className="discussions-page"><Link to={`/clubs/${club.id}/discussions${search}`}>Назад до обговорень</Link>
    <div tabIndex={-1} ref={heading}><PageHeading title={topic?.deleted_at ? 'Тему видалено' : topic?.title ?? 'Обговорення'} /></div>
    {notice && <p className="flash" role="status">{notice}</p>}{(error || failure) && <p role="alert" className="form-alert">{failure || error}</p>}
    <AppButton variant="secondary" disabled={busy} onClick={() => { setFailure(''); setConfirm(null); reload() }}>Оновити тему</AppButton>
    {!data && !error && <p role="status">Завантаження теми…</p>}
    {topic?.deleted_at && <p className="empty-state">Тему видалено. Її текст і коментарі недоступні.</p>}
    {topic && !topic.deleted_at && <>
      {club.archivedAt && <p className="flash">Архівний клуб: лише читання.</p>}
      <article className="discussion-card"><p className="field-hint">{topic.author_name} · <time dateTime={topic.created_at}>{new Date(topic.created_at).toLocaleString('uk-UA')}</time>{topic.created_at !== topic.updated_at && ' · відредаговано'}</p>
        {topic.book_title && <p>Книга: <Link to={`/clubs/${club.id}/books`}>{topic.book_title}</Link></p>}
        <p className="discussion-text">{topic.body}</p><div className="form-actions">{topic.can_edit && <Link className="link-button link-button-secondary" to={`/clubs/${club.id}/discussions/${topicId}/edit${search}`}>Редагувати тему</Link>}{topic.can_delete && <AppButton variant="danger" disabled={busy} onClick={(e) => ask(null, e.currentTarget)}>Видалити тему</AppButton>}</div>
      </article>
      <section aria-labelledby="discussion-comments"><h2 id="discussion-comments">Коментарі</h2>
        {data.comments.items.length ? <ol className="discussion-list">{data.comments.items.map((comment) => <li key={comment.id}><DiscussionComment comment={comment} busy={busy}
          onSave={(draft, original) => perform(() => discussionService.saveComment(topicId, draft, original), 'Коментар збережено.')}
          onDelete={ask} /></li>)}</ol> : <p className="empty-state">{page > 1 ? 'На цій сторінці коментарів немає.' : 'Коментарів поки немає.'}</p>}
        <DiscussionPagination page={page} total={data.comments.total} busy={busy} onChange={(next) => { const query = new URLSearchParams(params); query.set('comments', String(next)); setParams(query) }} />
        {topic.can_comment && <CommentForm busy={busy} onSave={(draft) => perform(() => discussionService.saveComment(topicId, draft), 'Коментар додано.')} />}
      </section>
    </>}
    {confirm && <AdminConfirmation title={confirm.comment ? 'Видалити коментар?' : 'Видалити тему?'} busy={busy} onCancel={dismiss}
      onConfirm={() => void perform(() => confirm.comment ? discussionService.removeComment(confirm.comment) : discussionService.remove(confirm.topic), 'Запис видалено.')}>
      <p>{confirm.comment ? 'Текст буде очищено. Залишиться позначка про видалення.' : 'Текст теми буде очищено, а її коментарі стануть недоступними.'} Відновлення неможливе.</p>
    </AdminConfirmation>}
  </div>
}
export default function DiscussionDetailsPage() { return <DiscussionScope>{(club, user, id) => <Details club={club} topicId={id} />}</DiscussionScope> }
