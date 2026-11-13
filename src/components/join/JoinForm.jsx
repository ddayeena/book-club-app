import AppButton from '../ui/AppButton.jsx'
import FormField from '../ui/FormField.jsx'
import { experienceOptions, participationOptions } from '../../domain/options.js'

export default function JoinForm({
  idPrefix, clubName, draft, errors, operationError, isSubmitting,
  onChange, onBlur, onSubmit, onReset, submitLabel,
}) {
  const motivationId = `${idPrefix}-motivation`
  const hoursId = `${idPrefix}-hours`
  const experienceId = `${idPrefix}-experience`
  const formatId = `${idPrefix}-format`
  const emailId = `${idPrefix}-email`
  const remindersId = `${idPrefix}-reminders`
  const hasErrors = Object.keys(errors).length > 0

  function describedBy(id, error) {
    return `${id}-hint${error ? ` ${id}-error` : ''}`
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      aria-label="Форма заявки на приєднання"
      aria-busy={isSubmitting}
    >
      <p>Клуб: {clubName}</p>
      <p>
        Збережіть зміни кнопкою нижче. Незбережене введення зникає при
        виході зі сторінки або її перезавантаженні.
      </p>
      {hasErrors && <p role="alert">Виправте позначені поля.</p>}
      {errors.clubId && <p role="alert">{errors.clubId}</p>}
      {operationError && <p role="alert">{operationError}</p>}

      <fieldset className="fieldset-plain" disabled={isSubmitting}>
        <legend className="field-hint">Дані заявки</legend>

        <FormField
          id={motivationId}
          label="Чому хочете приєднатися (обов'язково)"
          hint="Від 10 до 500 символів без крайніх пробілів."
          error={errors.motivation}
        >
          <textarea
            id={motivationId}
            name="motivation"
            rows={3}
            required
            value={draft.motivation}
            onChange={(event) => onChange('motivation', event.target.value)}
            onBlur={() => onBlur('motivation')}
            aria-invalid={Boolean(errors.motivation)}
            aria-describedby={describedBy(motivationId, errors.motivation)}
          />
        </FormField>

        <div className="form-grid">
          <FormField
            id={hoursId}
            label="Годин на тиждень"
            hint="Обов'язково. Ціле число від 1 до 8."
            error={errors.weeklyHours}
          >
            <input
              id={hoursId}
              name="weeklyHours"
              type="number"
              min={1}
              max={8}
              step={1}
              required
              value={draft.weeklyHours}
              onChange={(event) => onChange('weeklyHours', event.target.value)}
              onBlur={() => onBlur('weeklyHours')}
              aria-invalid={Boolean(errors.weeklyHours)}
              aria-describedby={describedBy(hoursId, errors.weeklyHours)}
            />
          </FormField>

          <FormField
            id={experienceId}
            label="Досвід читання"
            hint="Обов'язково. Допоможе підібрати темп обговорень."
            error={errors.experience}
          >
            <select
              id={experienceId}
              name="experience"
              value={draft.experience}
              onChange={(event) => onChange('experience', event.target.value)}
              onBlur={() => onBlur('experience')}
              aria-invalid={Boolean(errors.experience)}
              aria-describedby={describedBy(experienceId, errors.experience)}
            >
              {experienceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            id={formatId}
            label="Бажаний формат участі"
            hint="Обов'язково. Онлайн, офлайн або без різниці."
            error={errors.participationFormat}
          >
            <select
              id={formatId}
              name="participationFormat"
              value={draft.participationFormat}
              onChange={(event) => onChange('participationFormat', event.target.value)}
              onBlur={() => onBlur('participationFormat')}
              aria-invalid={Boolean(errors.participationFormat)}
              aria-describedby={describedBy(formatId, errors.participationFormat)}
            >
              {participationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            id={emailId}
            label="Контактна пошта"
            hint="Необов'язково. Для відповіді клубу."
            error={errors.contactEmail}
          >
            <input
              id={emailId}
              name="contactEmail"
              type="email"
              autoComplete="email"
              value={draft.contactEmail}
              onChange={(event) => onChange('contactEmail', event.target.value)}
              onBlur={() => onBlur('contactEmail')}
              aria-invalid={Boolean(errors.contactEmail)}
              aria-describedby={describedBy(emailId, errors.contactEmail)}
            />
          </FormField>
        </div>

        <div>
          <label className="checkbox-field" htmlFor={remindersId}>
            <input
              id={remindersId}
              name="wantsReminders"
              type="checkbox"
              checked={draft.wantsReminders}
              onChange={(event) => onChange('wantsReminders', event.target.checked)}
              onBlur={() => onBlur('wantsReminders')}
              aria-invalid={Boolean(errors.wantsReminders)}
              aria-describedby={describedBy(remindersId, errors.wantsReminders)}
            />
            Надсилати нагадування про зустрічі клубу
          </label>
          <p id={`${remindersId}-hint`} className="field-hint">
            При навантаженні понад 4 години на тиждень нагадування обов'язкові.
          </p>
          {errors.wantsReminders && (
            <p id={`${remindersId}-error`} className="field-error">{errors.wantsReminders}</p>
          )}
        </div>

        <div className="form-actions">
          <AppButton type="submit">
            {isSubmitting ? 'Збереження…' : submitLabel}
          </AppButton>
          <AppButton variant="secondary" onClick={onReset} disabled={isSubmitting}>
            Відновити початкові поля
          </AppButton>
        </div>
      </fieldset>
      <p role="status">{isSubmitting ? 'Збереження заявки…' : ''}</p>
    </form>
  )
}