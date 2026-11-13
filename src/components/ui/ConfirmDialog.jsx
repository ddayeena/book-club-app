import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { errorMessage } from '../../services/ServiceError.js'

export default function ConfirmDialog({ title, children, busy = false, error = '', danger = true, confirmLabel = 'Підтвердити', cancelLabel = 'Скасувати', confirmDisabled = false, onConfirm, onCancel }) {
  const id = useId(), panel = useRef(null), cancel = useRef(null), confirm = useRef(null), opener = useRef(null)
  const lock = useRef(false), alive = useRef(false)
  const [pending, setPending] = useState(false), [failure, setFailure] = useState('')
  const working = busy || pending
  useEffect(() => {
    const dialog = panel.current
    alive.current = true
    if (!opener.current) opener.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    dialog.showModal() // Native top layer supplies focus containment and background inertness.
    cancel.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      alive.current = false
      const restore = dialog.contains(document.activeElement) || document.activeElement === document.body
      if (dialog.open) dialog.close()
      document.body.style.overflow = previousOverflow
      if (restore && opener.current?.isConnected) opener.current.focus()
    }
  }, [])
  function dismiss() { if (!working && !lock.current) onCancel() }
  async function submit() {
    if (working || lock.current || confirmDisabled) return
    lock.current = true; setPending(true); setFailure('')
    try { await onConfirm() }
    catch (cause) { if (alive.current) setFailure(errorMessage(cause)) }
    finally { lock.current = false; if (alive.current) setPending(false) }
  }
  return createPortal(<dialog ref={panel} className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={working}
    onCancel={(event) => { event.preventDefault(); dismiss() }} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss() }
      if (event.key === 'Enter' && event.target !== confirm.current && event.target !== cancel.current) event.preventDefault()
    }}>
    <h2 id={`${id}-title`}>{title}</h2><div id={`${id}-description`}>{children}</div>
    {(failure || error) && <p className="form-alert" role="alert">{failure || error}</p>}
    <div className="form-actions"><button ref={confirm} type="button" className={`app-button app-button-${danger ? 'danger' : 'primary'}`} disabled={working || confirmDisabled} onClick={() => void submit()}>{working ? 'Виконання…' : confirmLabel}</button>
      <button ref={cancel} type="button" className="app-button app-button-secondary" disabled={working} onClick={dismiss}>{cancelLabel}</button></div>
  </dialog>, document.body)
}
