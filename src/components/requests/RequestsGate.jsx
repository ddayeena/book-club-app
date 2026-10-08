import useRequests from '../../hooks/useRequests.js'
import AppButton from '../ui/AppButton.jsx'

export default function RequestsGate({ children }) {
  const { status, error, reload } = useRequests()

  if (status === 'loading') {
    return (
      <section className="state-banner state-loading" aria-busy="true" aria-label="Заявки">
        <span className="state-spinner" aria-hidden="true">
          <span /><span /><span />
        </span>
        <p role="status">Завантаження заявок…</p>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="state-banner state-error" aria-label="Помилка завантаження">
        <span className="state-icon" aria-hidden="true">⚠️</span>
        <p role="alert">{error}</p>
        <AppButton variant="secondary" onClick={() => void reload()}>
          Спробувати ще раз
        </AppButton>
      </section>
    )
  }

  return children
}