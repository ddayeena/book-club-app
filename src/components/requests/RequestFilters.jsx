import AppButton from '../ui/AppButton.jsx'
import FormField from '../ui/FormField.jsx'

export default function RequestFilters({
  query, reminders, sort, onQueryChange, onRemindersChange, onSortChange, onReset,
}) {
  return (
    <div className="request-filters">
      <FormField id="requests-query" label="Пошук у заявках">
        <input
          id="requests-query"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </FormField>
      <FormField id="requests-reminders" label="Нагадування">
        <select
          id="requests-reminders"
          value={reminders}
          onChange={(event) => onRemindersChange(event.target.value)}
        >
          <option value="all">Усі заявки</option>
          <option value="yes">З нагадуваннями</option>
          <option value="no">Без нагадувань</option>
        </select>
      </FormField>
      <FormField id="requests-sort" label="Упорядкування">
        <select
          id="requests-sort"
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
        >
          <option value="club">За назвою клубу</option>
          <option value="hours-asc">Спочатку менше годин</option>
          <option value="hours-desc">Спочатку більше годин</option>
        </select>
      </FormField>
      <AppButton variant="secondary" onClick={onReset}>Скинути умови</AppButton>
    </div>
  )
}