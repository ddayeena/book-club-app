import AppButton from '../ui/AppButton.jsx'
import FormField from '../ui/FormField.jsx'
import { experienceOptions, participationOptions } from '../../domain/options.js'

export default function RequestFilters({
  query, reminders, experience, format, club, sort, clubs,
  onQueryChange, onRemindersChange, onExperienceChange,
  onFormatChange, onClubChange, onSortChange, onReset,
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

      <FormField id="requests-club" label="Клуб">
        <select
          id="requests-club"
          value={club}
          onChange={(event) => onClubChange(event.target.value)}
        >
          <option value="all">Усі клуби</option>
          {clubs.map((entry) => (
            <option key={entry.id} value={entry.id}>{entry.name}</option>
          ))}
        </select>
      </FormField>

      <FormField id="requests-experience" label="Досвід читання">
        <select
          id="requests-experience"
          value={experience}
          onChange={(event) => onExperienceChange(event.target.value)}
        >
          <option value="all">Будь-який</option>
          {experienceOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </FormField>

      <FormField id="requests-format" label="Формат участі">
        <select
          id="requests-format"
          value={format}
          onChange={(event) => onFormatChange(event.target.value)}
        >
          <option value="all">Будь-який</option>
          {participationOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
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
          <option value="newest">Спочатку нові</option>
          <option value="hours-asc">Спочатку менше годин</option>
          <option value="hours-desc">Спочатку більше годин</option>
        </select>
      </FormField>

      <AppButton variant="secondary" onClick={onReset}>Скинути умови</AppButton>
    </div>
  )
}