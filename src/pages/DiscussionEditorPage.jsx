import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import DiscussionScope from '../components/discussions/DiscussionScope.jsx'
import DiscussionForm from '../components/discussions/DiscussionForm.jsx'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import useDiscussionResource from '../hooks/useDiscussionResource.js'
import useAuth from '../hooks/useAuth.js'
import { discussionService } from '../services/discussionService.js'
import { errorMessage } from '../services/ServiceError.js'

function Editor({ club, user, topicId }) {
  const { data, error, reload } = useDiscussionResource('editor', club.id, topicId)
  const [failure, setFailure] = useState(''), [busy, setBusy] = useState(false)
  const navigate = useNavigate(), { search } = useLocation(), { refreshAccess } = useAuth()
  const lock = useRef(false), alive = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  async function save(draft) {
    if (lock.current) return
    lock.current = true; setBusy(true); setFailure('')
    try {
      const id = await discussionService.save(club.id, draft, data.topic)
      if (alive.current) navigate(`/clubs/${club.id}/discussions/${id}${search}`, { replace: true })
    } catch (cause) { if (alive.current) { setFailure(errorMessage(cause)); if (cause.code === '42501') void refreshAccess() } }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  const allowed = !club.archivedAt && (topicId ? data?.topic?.can_edit : club.ownerId === user.id || club.isMember)
  return <div className="discussions-page"><Link to={`/clubs/${club.id}/discussions${search}`}>Назад до обговорень</Link><PageHeading title={topicId ? 'Редагування теми' : 'Нова тема'} />
    {(error || failure) && <p role="alert" className="form-alert">{failure || error}</p>}
    <AppButton variant="secondary" disabled={busy} onClick={() => { setFailure(''); reload() }}>Перечитати актуальні дані</AppButton>
    {!data && !error && <p role="status">Завантаження форми…</p>}
    {data && (allowed ? <DiscussionForm key={data.topic?.updated_at ?? 'new'} topic={data.topic} books={data.books} busy={busy} onSave={save} /> : <p className="flash">{data.topic?.deleted_at ? 'Тему видалено.' : 'Редагування недоступне. Архівні та чужі записи — лише для читання.'}</p>)}
  </div>
}
export default function DiscussionEditorPage() { return <DiscussionScope>{(club, user, id) => <Editor club={club} user={user} topicId={id} />}</DiscussionScope> }
