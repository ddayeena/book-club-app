import { useNavigate, useParams } from 'react-router'
import JoinPage from './JoinPage.jsx'
import NotFoundPage from './NotFoundPage.jsx'

export default function RequestEditPage({ requests, clubs }) {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const request = requests.find((entry) => entry.id === requestId)

  if (!request) {
    return (
      <NotFoundPage
        title="Заявку не знайдено"
        message="Перевірте ідентифікатор заявки в адресі."
      />
    )
  }

  const club = clubs.find((entry) => entry.id === request.clubId)

  if (!club) {
    return (
      <NotFoundPage
        title="Клуб заявки відсутній"
        message="Демонстраційний запис посилається на клуб, якого немає в каталозі."
      />
    )
  }

  return (
    <JoinPage
      key={`edit-${request.id}`}
      title={`Редагування заявки ${request.id}`}
      club={club}
      initialDraft={{
        motivation: request.motivation,
        wantsReminders: request.wantsReminders,
      }}
      onCancel={() => navigate('/requests')}
    />
  )
}