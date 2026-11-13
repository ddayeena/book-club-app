import { useEffect, useRef, useState } from 'react'
import useAuth from '../../hooks/useAuth.js'
import useClubs from '../../hooks/useClubs.js'
import AppButton from '../ui/AppButton.jsx'
import AdminConfirmation from '../admin/AdminConfirmation.jsx'
import { errorMessage } from '../../services/ServiceError.js'

export default function RestoreClubButton({ club }) {
  const { user } = useAuth()
  const { restoreClub, isMutating } = useClubs()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const opener = useRef(null), feedback = useRef(null), lock = useRef(false), alive = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => { if (notice) feedback.current?.focus() }, [notice])
  const allowed = user && (user.id === club.ownerId || user.role === 'admin')
  const disabled = busy || isMutating
  function close() {
    if (lock.current || isMutating) return
    setConfirming(false)
    opener.current?.querySelector('button')?.focus()
  }
  async function restore() {
    if (!allowed || !club.archivedAt || lock.current || isMutating) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const result = await restoreClub(club.id)
      if (!alive.current) return
      if (result.ok) { setConfirming(false); setNotice('Клуб відновлено.') }
      else setError(result.message || 'Не вдалося відновити клуб. Спробуйте ще раз.')
    } catch (cause) { if (alive.current) setError(errorMessage(cause)) }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  if (!allowed) return null
  return <>
    {error && !confirming && <p role="alert" className="form-alert">{error}</p>}
    {notice && <p ref={feedback} tabIndex={-1} role="status" className="flash">{notice}</p>}
    {club.archivedAt && <span ref={opener}><AppButton variant="secondary" disabled={disabled} onClick={() => { setError(''); setConfirming(true) }}>Відновити клуб</AppButton></span>}
    {club.archivedAt && confirming && <AdminConfirmation title="Відновити клуб?" danger={false} busy={disabled} error={error} onCancel={close} onConfirm={restore}>
      <p>Клуб знову стане активним і доступним у каталозі. Раніше скасовані зустрічі та голосування автоматично не відновляться.</p>
    </AdminConfirmation>}
  </>
}
