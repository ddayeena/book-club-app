import useRequests from './useRequests.js'
import useClubs from './useClubs.js'
import useConfirmAction from './useConfirmAction.jsx'

export default function useDeleteRequest() {
  const { deleteRequest } = useRequests()
  const { clubs } = useClubs()
  const { ask, confirmation } = useConfirmAction()

  function deleteWithConfirmation(request, onSuccess) {
    const club = clubs.find((entry) => entry.id === request.clubId)
    const name = club?.name ?? request.clubId
    ask({ title: request.status ? `Скасувати заявку до клубу «${name}»?` : `Видалити заявку ${request.id} до клубу «${name}»?`,
      description: request.status ? 'Історія збережеться.' : 'Запис буде вилучено з поточної колекції.', action: async () => {
        const result = await deleteRequest(request.id)
        if (result.ok) onSuccess?.()
        return result
      } })
  }
  return { deleteWithConfirmation, confirmation }
}
