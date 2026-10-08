import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'
import useRequests from '../hooks/useRequests.js'
import JoinPage from './JoinPage.jsx'
import NotFoundPage from './NotFoundPage.jsx'

export default function RequestEditPage({ clubs }) {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const { requests, updateRequest } = useRequests()
  const request = requests.find((entry) => entry.id === requestId)
  const pageAlive = useRef(false)
  const activeId = useRef(requestId)

  useEffect(() => {
    pageAlive.current = true
    return () => { pageAlive.current = false }
  }, [])

  useEffect(() => {
    activeId.current = requestId
    return () => { activeId.current = null }
  }, [requestId])

  if (!request) {
    return <NotFoundPage title="Заявку для редагування не знайдено" />
  }

  const club = clubs.find((entry) => entry.id === request.clubId)
  if (!club) return <NotFoundPage title="Клуб заявки відсутній" />

  async function handleSave(input) {
    const result = await updateRequest(request.id, input)
    if (result.ok && pageAlive.current && activeId.current === request.id) {
      navigate(`/requests/${encodeURIComponent(result.record.id)}`, {
        replace: true,
      })
    }
    return result
  }

  return (
    <JoinPage
      key={`edit-${request.id}`}
      title={`Редагування заявки ${request.id}`}
      club={club}
      initialDraft={{
        motivation: request.motivation,
        weeklyHours: request.weeklyHours,
        wantsReminders: request.wantsReminders,
      }}
      onSave={handleSave}
      submitLabel="Зберегти зміни"
      onCancel={() => navigate(`/requests/${encodeURIComponent(request.id)}`)}
    />
  )
}