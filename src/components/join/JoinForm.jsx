import AppButton from '../ui/AppButton.jsx'
import FormField from '../ui/FormField.jsx'

export default function JoinForm({
  idPrefix, clubName, draft, errors, operationError,
  onChange, onBlur, onSubmit, onReset, submitLabel,
}) {
  const motivationId = `${idPrefix}-motivation`
  const hoursId = `${idPrefix}-hours`
  const remindersId = `${idPrefix}-reminders`
  const hasErrors = Object.keys(errors).length > 0

  function describedBy(id, error) {
    return `${id}-hint${error ? ` ${id}-error` : ''}`
  }

  return (
    <form noValidate onSubmit={onSubmit} aria-label="Форма заявки на приєднання">
      <p>Клуб: {clubName}</p>
      <p>
        Збережіть зміни кнопкою нижче. Незбережене введення зникає при
        виході зі сторінки або її перезавантаженні.
      </p>
      {hasErrors && <p role="alert">Виправте позначені поля.</p>}
      {errors.clubId && <p role="alert">{errors.clubId}</p>}
      {operationError && <p role="alert">{operationError}</p>}

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

      <FormField
        id={hoursId}
        label="Годин на тиждень для клубу (обов'язково)"
        hint="Ціле число від 1 до 8."
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
        <AppButton type="submit">{submitLabel}</AppButton>
        <AppButton variant="secondary" onClick={onReset}>
          Відновити початкові поля
        </AppButton>
      </div>
    </form>
  )
}