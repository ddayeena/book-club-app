import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import useRequests from '../hooks/useRequests.js'
import useDeleteRequest from '../hooks/useDeleteRequest.js'
import NotFoundPage from './NotFoundPage.jsx'

export default function RequestDetailsPage({ clubs }) {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const { requests } = useRequests()
  const deleteWithConfirmation = useDeleteRequest(clubs)
  const [error, setError] = useState('')
  const request = requests.find((entry) => entry.id === requestId)

  if (!request) return <NotFoundPage title="Заявку не знайдено" />
  const club = clubs.find((entry) => entry.id === request.clubId)

  function handleDelete() {
    setError('')
    const result = deleteWithConfirmation(request)
    if (result.ok) navigate('/requests', { replace: true })
    else if (!result.cancelled) setError(result.message)
  }

  return (
    <>
      <PageHeading title={`Заявка ${request.id}`} />
      {error && <p role="alert">{error}</p>}

      <aside className="summary-card" aria-labelledby="request-details-title">
        <h3 id="request-details-title">Збережена заявка</h3>
        <dl>
          <dt>Клуб</dt>
          <dd>{club?.name ?? 'Клуб відсутній у каталозі'}</dd>
          <dt>Мотивація</dt>
          <dd>{request.motivation}</dd>
          <dt>Годин на тиждень</dt>
          <dd>{request.weeklyHours}</dd>
          <dt>Нагадування про зустрічі</dt>
          <dd>
            <span className={`summary-badge ${request.wantsReminders ? 'on' : 'off'}`}>
              {request.wantsReminders ? 'Увімкнено' : 'Вимкнено'}
            </span>
          </dd>
        </dl>
        <p className="summary-note">Збережена заявка не є підтвердженням членства.</p>
      </aside>

      <p>
        <Link to={`/requests/${encodeURIComponent(request.id)}/edit`} className="link-inline">
          Редагувати заявку
        </Link>
      </p>
      <AppButton variant="secondary" onClick={handleDelete}>
        Видалити заявку
      </AppButton>
      <p><Link to="/requests" className="link-inline">До всіх заявок</Link></p>
    </>
  )
}