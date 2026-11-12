import AppButton from '../ui/AppButton.jsx'
import FormField from '../ui/FormField.jsx'
import { clubFormatOptions, languageOptions } from '../../domain/options.js'

export default function ClubForm({
  idPrefix, draft, errors, operationError, genres,
  onChange, onBlur, onSubmit, onCancel, submitLabel, isSubmitting = false,
}) {
  const ids = {
    name: `${idPrefix}-name`,
    genre: `${idPrefix}-genre`,
    description: `${idPrefix}-description`,
    format: `${idPrefix}-format`,
    language: `${idPrefix}-language`,
    meetings: `${idPrefix}-meetings`,
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
      <fieldset className="fieldset-plain" disabled={isSubmitting}>
      <legend className="visually-hidden">Дані клубу</legend>

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

        <p className="field-hint">Книги додаються та редагуються на книжковій полиці після створення клубу.</p>
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

        <p className="field-hint">Дати й час додаються в розділі «Зустрічі» після створення клубу.</p>
      </div>

      <div className="form-actions">
        <AppButton type="submit">{submitLabel}</AppButton>
        <AppButton variant="secondary" onClick={onCancel}>Скасувати</AppButton>
      </div>
      </fieldset>
    </form>
  )
}
