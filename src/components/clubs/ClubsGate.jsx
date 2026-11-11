import useClubs from '../../hooks/useClubs.js'
import AppButton from '../ui/AppButton.jsx'
export default function ClubsGate({ children }) {
  const { status, error, reload } = useClubs()
  if (status === 'loading') return <p role="status">Завантаження клубів…</p>
  if (status === 'error') return <section className="state-banner state-error"><p role="alert">{error}</p><AppButton onClick={() => void reload()}>Спробувати ще раз</AppButton></section>
  return children
}
