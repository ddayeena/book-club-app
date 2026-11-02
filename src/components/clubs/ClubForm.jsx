import AppButton from '../ui/AppButton.jsx'
import FormField from '../ui/FormField.jsx'
import { clubFormatOptions, languageOptions } from '../../domain/options.js'

export default function ClubForm({
  idPrefix, draft, errors, operationError, genres,
  onChange, onBlur, onSubmit, onCancel, submitLabel,
}) {
  const ids = {
    name: `${idPrefix}-name`,
    genre: `${idPrefix}-genre`,
    description: `${idPrefix}-description`,
    book: `${idPrefix}-book`,
    format: `${idPrefix}-format`,
    language: `${idPrefix}-language`,
    meetings: `${idPrefix}-meetings`,
    meeting: `${idPrefix}-meeting`,
  }
  const listId = `${idPrefix}-genres`
  const hasErrors = Object.keys(errors).length > 0

  function describedBy(id, error) {
    return `${id}-hint${error ? ` ${id}-error` : ''}`
  }

  function bind(field, id) {
    return {
      id,
      name: field,
      value: draft[field],
      onChange: (event) => onChange(field, event.target.value),
      onBlur: () => onBlur(field),
      'aria-invalid': Boolean(errors[field]),
      'aria-describedby': describedBy(id, errors[field]),
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} aria-label="Форма клубу">
      {hasErrors && <p role="alert" className="form-alert">Виправте позначені поля.</p>}
      {operationError && <p role="alert" className="form-alert">{operationError}</p>}

      <FormField
        id={ids.name}
        label="Назва клубу"
        hint="Від 3 до 60 символів."
        error={errors.name}
      >
        <input type="text" required {...bind('name', ids.name)} />
      </FormField>

      <div className="form-grid">
        <FormField
          id={ids.genre}
          label="Жанр"
          hint="Оберіть із підказки або впишіть свій."
          error={errors.genre}
        >
          <input type="text" required list={listId} {...bind('genre', ids.genre)} />
          <datalist id={listId}>
            {genres.map((genre) => <option key={genre} value={genre} />)}
          </datalist>
        </FormField>

        <FormField
          id={ids.book}
          label="Поточна книга"
          hint="Необов'язково. Можна додати пізніше."
          error={errors.currentBook}
        >
          <input type="text" {...bind('currentBook', ids.book)} />
        </FormField>
      </div>

      <FormField
        id={ids.description}
        label="Опис"
        hint="Про що клуб і кого чекаєте. Від 10 до 400 символів."
        error={errors.description}
      >
        <textarea rows={4} required {...bind('description', ids.description)} />
      </FormField>

      <div className="form-grid">
        <FormField id={ids.format} label="Формат зустрічей" error={errors.format}>
          <select {...bind('format', ids.format)}>
            {clubFormatOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FormField>

        <FormField id={ids.language} label="Мова спілкування" error={errors.language}>
          <select {...bind('language', ids.language)}>
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </FormField>

        <FormField
          id={ids.meetings}
          label="Зустрічей на місяць"
          hint="Ціле число від 1 до 8."
          error={errors.meetingsPerMonth}
        >
          <input type="number" min={1} max={8} step={1} required {...bind('meetingsPerMonth', ids.meetings)} />
        </FormField>

        <FormField
          id={ids.meeting}
          label="Найближча зустріч"
          hint="Орієнтовна дата."
          error={errors.nextMeeting}
        >
          <input type="date" required {...bind('nextMeeting', ids.meeting)} />
        </FormField>
      </div>

      <div className="form-actions">
        <AppButton type="submit">{submitLabel}</AppButton>
        <AppButton variant="secondary" onClick={onCancel}>Скасувати</AppButton>
      </div>
    </form>
  )
}
