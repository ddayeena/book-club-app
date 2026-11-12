import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import useAuth from '../../hooks/useAuth.js'
import { adminService } from '../../services/adminService.js'
import { errorMessage } from '../../services/ServiceError.js'
import AppButton from '../ui/AppButton.jsx'

export default function AdminClubMembers({ clubId, ownerId }) {
  const { refreshAccess } = useAuth()
  const [members, setMembers] = useState([])
  const [offset, setOffset] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const lock = useRef(false)
  const more = useRef(null)
  const nextMember = useRef(null)
  useEffect(() => {
    const controller = new AbortController()
    lock.current = true
    adminService.members(clubId, { offset, signal: controller.signal }).then((page) => {
      if (controller.signal.aborted) return
      setMembers((previous) => offset === 0 ? page.items : [...new Map([...previous, ...page.items].map((member) => [member.id, member])).values()])
      nextMember.current = offset > 0 ? page.items[0]?.id : null
      setHasMore(page.hasMore); setLoading(false); lock.current = false
    }).catch((cause) => {
      if (controller.signal.aborted) return
      setError(errorMessage(cause)); setLoading(false); lock.current = false
      if (cause.code === '42501') void refreshAccess()
    })
    return () => controller.abort()
  }, [clubId, offset, attempt, refreshAccess])
  useEffect(() => {
    if (!loading && nextMember.current) {
      Array.from(more.current?.querySelectorAll('a') ?? []).find((link) => link.dataset.memberId === nextMember.current)?.focus()
      nextMember.current = null
    }
  }, [loading])
  function request(nextOffset) {
    if (lock.current) return
    lock.current = true; setLoading(true); setError('')
    setOffset(nextOffset); setAttempt((n) => n + 1)
  }
  return <section className="admin-detail-card admin-club-members" aria-labelledby="admin-members-title">
    <div className="admin-members-heading"><h2 id="admin-members-title">Учасники клубу</h2>
      <AppButton variant="secondary" disabled={loading} onClick={() => request(0)}>Оновити учасників</AppButton></div>
    <p className="field-hint">Поточне членство, включно з власником. Відкрийте профіль, щоб переглянути стан акаунта.</p>
    {error && <div><p role="alert" className="form-alert">{error}</p>
      <AppButton variant="secondary" disabled={loading} onClick={() => request(offset)}>Повторити завантаження</AppButton></div>}
    {members.length > 0 && <ul className="admin-member-list" ref={more}>{members.map((member) => <li key={member.id}>
      <Link data-member-id={member.id} to={`/admin/users/${member.id}`}>{member.name}</Link>
      <span className={member.id === ownerId ? 'admin-member-owner' : 'field-hint'}>{member.id === ownerId ? 'Власник' : 'Учасник'}</span>
    </li>)}</ul>}
    {!loading && !error && !members.length && <p className="admin-members-empty">Поточних учасників не знайдено.</p>}
    {!loading && !error && members.length === 1 && members[0].id === ownerId && !hasMore && <p className="field-hint">У клубі поки лише власник. Додаткових учасників немає.</p>}
    {loading && <p role="status">Завантаження учасників…</p>}
    {members.length > 0 && <p role="status" className="field-hint">Показано учасників: {members.length}</p>}
    {hasMore && !error && <div className="form-actions"><AppButton variant="secondary" disabled={loading}
      onClick={() => request(offset + 20)}>Показати більше</AppButton></div>}
  </section>
}
