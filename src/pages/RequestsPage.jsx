import { useState } from 'react'
import { Link } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import RequestFilters from '../components/requests/RequestFilters.jsx'
import RequestTable from '../components/requests/RequestTable.jsx'
import useRequests from '../hooks/useRequests.js'
import useRequestFilters from '../hooks/useRequestFilters.js'
import useDeleteRequest from '../hooks/useDeleteRequest.js'
import { failNextMockRequest } from '../services/mockRequestService.js'

export default function RequestsPage({ clubs }) {
  const { requests, isMutating, reload } = useRequests()
  const filters = useRequestFilters(requests, clubs)
  const deleteWithConfirmation = useDeleteRequest(clubs)
  const [error, setError] = useState('')

  async function handleDelete(request) {
    setError('')
    const result = await deleteWithConfirmation(request)
    if (!result.ok && !result.cancelled) setError(result.message)
  }

  return (
    <>
      <PageHeading title="Заявки на приєднання" />
      <div className="page-toolbar">
        <Link to="/requests/new" className="link-button">Створити заявку</Link>
        <AppButton variant="secondary" disabled={isMutating} onClick={() => void reload()}>
          Оновити дані
        </AppButton>
      </div>
      <RequestFilters
        query={filters.query}
        reminders={filters.reminders}
        sort={filters.sort}
        onQueryChange={filters.setQuery}
        onRemindersChange={filters.setReminders}
        onSortChange={filters.setSort}
        onReset={filters.resetFilters}
      />
      {error && <p role="alert">{error}</p>}
      {requests.length === 0 ? (
        <EmptyState title="Заявок ще немає.">
          <p><Link to="/clubs" className="link-inline">Виберіть клуб для першої заявки</Link></p>
        </EmptyState>
      ) : filters.visibleRequests.length === 0 ? (
        <EmptyState title="За цими умовами нічого не знайдено.">
          <AppButton variant="secondary" onClick={filters.resetFilters}>
            Показати всі заявки
          </AppButton>
        </EmptyState>
      ) : (
        <>
          <p role="status">Знайдено заявок: {filters.visibleRequests.length} із {requests.length}</p>
          <RequestTable requests={filters.visibleRequests} clubs={clubs} onDelete={handleDelete} />
        </>
      )}

      {import.meta.env.DEV && (import.meta.env.VITE_DATA_SOURCE ?? 'mock') === 'mock' && (
        <div className="dev-panel">
          <p>Лише для розробки — перевірка відмов mock-сервісу</p>
          <AppButton
            variant="secondary"
            disabled={isMutating}
            onClick={() => {
              failNextMockRequest('getAll')
              void reload()
            }}
          >
            Перевірити відмову читання
          </AppButton>
        </div>
      )}
    </>
  )
}