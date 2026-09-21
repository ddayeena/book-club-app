import AppButton from '../ui/AppButton.jsx'
import FormField from '../ui/FormField.jsx'

export default function JoinFormPreview({ idPrefix, clubName }) {
  const nameId = `${idPrefix}-name`
  const motivationId = `${idPrefix}-motivation`
  const noticeId = `${idPrefix}-notice`

  return (
    <form
      aria-label="Макет заявки на приєднання до клубу"
      aria-describedby={noticeId}
      onSubmit={(event) => event.preventDefault()}
    >
      <p id={noticeId}>
        Це макет для перевірки структури полів. Дані не зберігаються.
      </p>

      <FormField id={nameId} label="Клуб">
        <input
          id={nameId}
          name="clubName"
          value={clubName}
          readOnly
        />
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
          defaultValue=""
          aria-describedby={`${motivationId}-hint`}
        />
      </FormField>

      <div className="form-actions">
        <AppButton type="reset" variant="secondary">
          Очистити текст
        </AppButton>
        <AppButton disabled>Надсилання буде доступне пізніше</AppButton>
      </div>
    </form>
  )
}