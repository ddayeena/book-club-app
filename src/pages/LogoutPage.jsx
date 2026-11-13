import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router'
import useAuth from '../hooks/useAuth.js'
import AppButton from '../components/ui/AppButton.jsx'

export default function LogoutPage() {
  const { logout } = useAuth()
  const [result, setResult] = useState(null)
  const operation = useRef(null)
  useEffect(() => {
    let alive = true
    operation.current ??= logout()
    operation.current.then((value) => { if (alive) setResult(value) })
    return () => { alive = false }
  }, [logout])
  if (result?.ok) return <Navigate to="/" replace />
  if (result) return <><p role="alert">{result.message}</p><AppButton onClick={() => { operation.current = logout(); operation.current.then(setResult) }}>Повторити вихід</AppButton></>
  return <p role="status">Вихід…</p>
}
