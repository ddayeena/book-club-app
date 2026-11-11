import useAuth from '../../hooks/useAuth.js'
import AppButton from '../ui/AppButton.jsx'

export default function AuthGate({ children }) {
  const { status, error, retry, logout } = useAuth()
  if (status === 'loading') return <p role="status">Відновлення сеансу…</p>
  if (status === 'error') return (
    <section className="state-banner state-error">
      <p role="alert">{error}</p>
      <AppButton onClick={() => void retry()}>Спробувати ще раз</AppButton>
      <AppButton variant="secondary" onClick={() => void logout()}>Вийти із сеансу</AppButton>
    </section>
  )
  return children
}
