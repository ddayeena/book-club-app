import AppButton from '../ui/AppButton.jsx'
import FormField from '../ui/FormField.jsx'
import { clubFormatOptions } from '../../domain/options.js'
import { catalogLanguageOptions, memberRangeOptions } from '../../domain/catalogFilters.js'

export default function ClubFilters({
  query,
  readingOnly,
  mine,
  canFilterMine,
  format,
  genre,
  sort,
  genres,
  onQueryChange,
  onReadingOnlyChange,
  onMineChange,
  onFormatChange,
  onGenreChange,
  onSortChange,
  onReset,
  language = 'all', members = 'all', meetingOnly = false,
  onLanguageChange, onMembersChange, onMeetingOnlyChange,
}) {
  const formatChoices = [{ value: 'all', label: 'Усі формати' }, ...clubFormatOptions]
  const activeCount = [
    query.trim() !== '',
    readingOnly,
    mine,
    format !== 'all',
    genre !== 'all',
    sort !== 'name',
    language !== 'all', members !== 'all', meetingOnly,
  ].filter(Boolean).length

  return (
    <details className="filters" open>
      <summary>
        Фільтри
        {activeCount > 0 && <span className="filters-count">{activeCount}</span>}
      </summary>

      <div className="filters-body">
        <FormField id="catalog-query" label="Пошук клубу">
          <input
            id="catalog-query"
            type="search"
            name="query"
            placeholder="Назва, жанр або книга"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </FormField>

        <FormField id="catalog-genre" label="Жанр">
          <select
            id="catalog-genre"
            value={genre}
            onChange={(event) => onGenreChange(event.target.value)}
          >
            <option value="all">Усі жанри</option>
            {genres.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </FormField>

        <FormField id="catalog-language" label="Мова клубу">
          <select id="catalog-language" value={language} onChange={(event) => onLanguageChange(event.target.value)}>
            <option value="all">Усі мови</option>{catalogLanguageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </FormField>
        <FormField id="catalog-members" label="Кількість учасників" hint="Включно з власником клубу.">
          <select id="catalog-members" value={members} aria-describedby="catalog-members-hint" onChange={(event) => onMembersChange(event.target.value)}>
            <option value="all">Будь-яка кількість</option>{memberRangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </FormField>
        <label className="checkbox-field"><input type="checkbox" checked={meetingOnly} onChange={(event) => onMeetingOnlyChange(event.target.checked)} />Є запланована зустріч</label>

        <FormField id="catalog-sort" label="Упорядкування">
          <select
            id="catalog-sort"
            value={sort}
            onChange={(event) => onSortChange(event.target.value)}
          >
            <option value="name">За назвою</option>
            <option value="members-desc">Найбільше учасників</option>
            <option value="meeting-asc">Найближча зустріч</option>
          </select>
        </FormField>

        <div className="filter-group">
          <p className="filter-label" id="format-label">Формат зустрічей</p>
          <div className="chip-group" role="group" aria-labelledby="format-label">
            {formatChoices.map((choice) => (
              <button
                key={choice.value}
                type="button"
                className="chip"
                aria-pressed={format === choice.value}
                onClick={() => onFormatChange(choice.value)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={readingOnly}
            onChange={(event) => onReadingOnlyChange(event.target.checked)}
          />
          Лише ті, що зараз читають книгу
        </label>

        {canFilterMine && (
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={mine}
              onChange={(event) => onMineChange(event.target.checked)}
            />
            Створені мною
          </label>
        )}

        <AppButton variant="secondary" onClick={onReset}>
          Скинути фільтри
        </AppButton>
      </div>
    </details>
  )
}
