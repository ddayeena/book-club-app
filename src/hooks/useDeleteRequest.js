import useRequests from './useRequests.js'
import useClubs from './useClubs.js'

export default function useDeleteRequest() {
  const { deleteRequest } = useRequests()
  const { clubs } = useClubs()

  return async function deleteWithConfirmation(request) {
    const club = clubs.find((entry) => entry.id === request.clubId)
    const name = club?.name ?? request.clubId
    const confirmed = window.confirm(
      `Видалити заявку ${request.id} до клубу «${name}»? `
      + 'Запис буде вилучено з поточної колекції. Скасування видалення не передбачено.',
    )
    if (!confirmed) return { ok: false, cancelled: true }
    return deleteRequest(request.id)
  }
}
