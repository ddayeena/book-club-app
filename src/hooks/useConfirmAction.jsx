import { useRef, useState } from 'react'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import { ServiceError } from '../services/ServiceError.js'

// Local to the caller; the action closure captures the item/version being confirmed.
export default function useConfirmAction() {
  const [target, setTarget] = useState(null), open = useRef(false)
  function ask(options) { if (!open.current) { open.current = true; setTarget(options) } }
  function close() { open.current = false; setTarget(null) }
  const confirmation = target && <ConfirmDialog title={target.title} danger={target.danger ?? true} confirmLabel={target.confirmLabel} onCancel={close} onConfirm={async () => {
    const result = await target.action()
    if (result === false || result?.ok === false) throw new ServiceError(result?.message || 'Не вдалося виконати дію. Спробуйте ще раз.')
    close()
  }}>{target.description}</ConfirmDialog>
  return { ask, confirmation }
}
