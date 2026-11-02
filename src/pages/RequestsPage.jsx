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
import useClubs from '../hooks/useClubs.js'

export default function RequestsPage() {
  const { clubs } = useClubs()
  const { requests, isMutating, reload } = useRequests()
  const filters = useRequestFilters(requests, clubs)
  const deleteWithConfirmation = useDeleteRequest()
  const [error, setError] = useState('')

  const withReminders = requests.filter((request) => request.wantsReminders).length
  const averageHours = requests.length === 0
    ? 0
    : requests.reduce((sum, request) => sum + request.weeklyHours, 0) / requests.length

  async function handleDelete(request) {
    setError('')
    const result = await deleteWithConfirmation(request)
    if (!result.ok && !result.cancelled) setError(result.message)
  }

  return (
    <>
      <PageHeading title="Заявки на приєднання" />

      <dl className="stat-strip">
        <div className="stat">
          <dt>Усього заявок</dt>
          <dd>{requests.length}</dd>
        </div>
        <div className="stat">
          <dt>З нагадуваннями</dt>
          <dd>{withReminders}</dd>
        </div>
        <div className="stat">
          <dt>Годин на тиждень у середньому</dt>
          <dd>{averageHours.toFixed(1)}</dd>
        </div>
      </dl>

      <div className="page-toolbar">
        <Link to="/requests/new" className="link-button">Створити заявку</Link>
        <AppButton variant="secondary" disabled={isMutating} onClick={() => void reload()}>
          Оновити дані
        </AppButton>
      </div>

      <RequestFilters
        query={filters.query}
        reminders={filters.reminders}
        experience={filters.experience}
        format={filters.format}
        club={filters.club}
        sort={filters.sort}
        clubs={clubs}
        onQueryChange={filters.setQuery}
        onRemindersChange={filters.setReminders}
        onExperienceChange={filters.setExperience}
        onFormatChange={filters.setFormat}
        onClubChange={filters.setClub}
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
          <p role="status">
            Знайдено заявок: {filters.visibleRequests.length} із {requests.length}
          </p>
          <RequestTable
            requests={filters.visibleRequests}
            clubs={clubs}
            onDelete={handleDelete}
            isMutating={isMutating}
          />
        </>
      )}
    </>
  )
}