import AppButton from '../ui/AppButton.jsx'
import FormField from '../ui/FormField.jsx'

export default function ClubFilters({
  query,
  readingOnly,
  onQueryChange,
  onReadingOnlyChange,
  onReset,
}) {
  return (
    <div className="catalog-filters">
      <FormField id="catalog-query" label="Пошук за назвою">
        <input
          id="catalog-query"
          type="search"
          name="query"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </FormField>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={readingOnly}
          onChange={(event) => onReadingOnlyChange(event.target.checked)}
        />
        Лише ті, що зараз читають книгу
      </label>
      <AppButton variant="secondary" onClick={onReset}>
        Скинути фільтри
      </AppButton>
    </div>
  )
}