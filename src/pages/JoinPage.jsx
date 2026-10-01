import { useState } from 'react'
import PageHeading from '../components/ui/PageHeading.jsx'
import Section from '../components/ui/Section.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import ReadingStatusBadge from '../components/clubs/ReadingStatusBadge.jsx'
import JoinForm from '../components/join/JoinForm.jsx'
import JoinSummary from '../components/join/JoinSummary.jsx'
import { validateRequest } from '../domain/requestValidation.js'

const emptyDraft = { motivation: '', weeklyHours: '1', wantsReminders: false }

export default function JoinPage({
  title, club, initialDraft = emptyDraft,
  onSave, onCancel, submitLabel, cancelLabel = 'Вийти без збереження',
}) {
  const initialValues = {
    motivation: initialDraft.motivation,
    weeklyHours: String(initialDraft.weeklyHours),
    wantsReminders: initialDraft.wantsReminders,
  }
  const [draft, setDraft] = useState(() => ({ ...initialValues }))
  const [touched, setTouched] = useState({})
  const [attempted, setAttempted] = useState(false)
  const [operationError, setOperationError] = useState('')
  const validation = validateRequest({ ...draft, clubId: club.id }, [club])
  const errors = Object.fromEntries(
    Object.entries(validation.errors).filter(([field]) => (
      attempted || touched[field]
    )),
  )
  const isDirty = draft.motivation !== initialValues.motivation
    || draft.weeklyHours !== initialValues.weeklyHours
    || draft.wantsReminders !== initialValues.wantsReminders

  function handleChange(field, value) {
    setDraft((previous) => ({ ...previous, [field]: value }))
    setOperationError('')
  }

  function handleBlur(field) {
    setTouched((previous) => ({ ...previous, [field]: true }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setAttempted(true)
    setOperationError('')
    if (!validation.ok) {
      const firstField = ['motivation', 'weeklyHours', 'wantsReminders']
        .find((field) => validation.errors[field])
      if (firstField) event.currentTarget.elements.namedItem(firstField)?.focus()
      return
    }

    const result = onSave(validation.value)
    if (!result.ok) {
      setOperationError(result.message || Object.values(result.errors).join(' '))
    }
  }

  function handleReset() {
    if (!isDirty) return
    if (!window.confirm('Відкинути введені зміни та відновити початкові поля?')) {
      return
    }
    setDraft({ ...initialValues })
    setTouched({})
    setAttempted(false)
    setOperationError('')
  }

  function handleCancel() {
    if (isDirty && !window.confirm('Вийти та відкинути незбережені зміни?')) return
    onCancel()
  }

  return (
    <>
      <PageHeading title={title} />
      <Section id="join-editor" title="Поля та підсумок">
        <p><ReadingStatusBadge currentBook={club.currentBook} /></p>
        <JoinForm
          idPrefix="join-draft"
          clubName={club.name}
          draft={draft}
          errors={errors}
          operationError={operationError}
          onChange={handleChange}
          onBlur={handleBlur}
          onSubmit={handleSubmit}
          onReset={handleReset}
          submitLabel={submitLabel}
        />
        <JoinSummary clubName={club.name} draft={draft} />
      </Section>
      <AppButton variant="secondary" onClick={handleCancel}>
        {cancelLabel}
      </AppButton>
    </>
  )
}