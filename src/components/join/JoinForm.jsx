import AppButton from '../ui/AppButton.jsx'
import FormField from '../ui/FormField.jsx'

export default function JoinForm({
  idPrefix,
  clubName,
  draft,
  onMotivationChange,
  onWantsRemindersChange,
  onReset,
}) {
  const nameId = `${idPrefix}-name`
  const motivationId = `${idPrefix}-motivation`
  const noticeId = `${idPrefix}-notice`

  return (
    <form
      aria-label="Чернетка заявки на приєднання до клубу"
      aria-describedby={noticeId}
      onSubmit={(event) => event.preventDefault()}
    >
      <p id={noticeId}>
        Чернетка існує лише до зміни клубу, скасування вибору або
        перезавантаження сторінки. Заявка не надсилається.
      </p>

      <FormField id={nameId} label="Клуб">
        <input id={nameId} name="clubName" value={clubName} readOnly />
      </FormField>

      <FormField
        id={motivationId}
        label="Чому хочете приєднатися"
        hint="Коротко опишіть свій інтерес до теми клубу."
      >
        <textarea
          id={motivationId}
          name="motivation"
          rows={3}
          value={draft.motivation}
          onChange={(event) => onMotivationChange(event.target.value)}
          aria-describedby={`${motivationId}-hint`}
        />
      </FormField>

      <label className="checkbox-field">
        <input
          name="wantsReminders"
          type="checkbox"
          checked={draft.wantsReminders}
          onChange={(event) => onWantsRemindersChange(event.target.checked)}
        />
        Надсилати нагадування про зустрічі клубу
      </label>

      <div className="form-actions">
        <AppButton variant="secondary" onClick={onReset}>
          Очистити поля
        </AppButton>
        <AppButton disabled>Надсилання буде доступне пізніше</AppButton>
      </div>
    </form>
  )
}