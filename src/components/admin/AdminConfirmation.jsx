import { useEffect, useRef } from 'react'
import AppButton from '../ui/AppButton.jsx'

export default function AdminConfirmation({ title, children, busy, onConfirm, onCancel }) {
  const panel = useRef(null)
  useEffect(() => { panel.current?.querySelectorAll('button')[1]?.focus() }, [])
  return <section ref={panel} className="book-replacement" role="alertdialog" aria-labelledby="admin-confirm-title"
    aria-describedby="admin-confirm-description" onKeyDown={(e) => { if (e.key === 'Escape' && !busy) onCancel() }}>
    <h2 id="admin-confirm-title">{title}</h2>
    <div id="admin-confirm-description">{children}</div>
    <div className="form-actions"><AppButton disabled={busy} onClick={onConfirm}>{busy ? 'Збереження…' : 'Підтвердити'}</AppButton>
      <AppButton variant="secondary" disabled={busy} onClick={onCancel}>Скасувати</AppButton></div>
  </section>
}
