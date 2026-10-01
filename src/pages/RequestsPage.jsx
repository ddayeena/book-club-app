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

export default function RequestsPage({ clubs }) {
  const { requests } = useRequests()
  const filters = useRequestFilters(requests, clubs)
  const deleteWithConfirmation = useDeleteRequest(clubs)
  const [error, setError] = useState('')

  function handleDelete(request) {
    setError('')
    const result = deleteWithConfirmation(request)
    if (!result.ok && !result.cancelled) setError(result.message)
  }

  return (
    <>
      <PageHeading title="Заявки на приєднання" />
      <p><Link to="/requests/new">Створити заявку</Link></p>
      <RequestFilters
        query={filters.query}
        reminders={filters.reminders}
        sort={filters.sort}
        onQueryChange={filters.setQuery}
        onRemindersChange={filters.setReminders}
        onSortChange={filters.setSort}
        onReset={filters.resetFilters}
      />
      <p>Показано: {filters.visibleRequests.length} із {requests.length}</p>
      {error && <p role="alert">{error}</p>}
      {requests.length === 0 ? (
        <EmptyState title="Заявок ще немає.">
          <p><Link to="/clubs">Виберіть клуб для першої заявки</Link></p>
        </EmptyState>
      ) : filters.visibleRequests.length === 0 ? (
        <EmptyState title="За цими умовами нічого не знайдено.">
          <AppButton variant="secondary" onClick={filters.resetFilters}>
            Показати всі заявки
          </AppButton>
        </EmptyState>
      ) : (
        <RequestTable
          requests={filters.visibleRequests}
          clubs={clubs}
          onDelete={handleDelete}
        />
      )}
    </>
  )
}