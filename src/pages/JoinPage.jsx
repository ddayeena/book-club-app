import { useEffect, useRef, useState } from 'react'
import PageHeading from '../components/ui/PageHeading.jsx'
import Section from '../components/ui/Section.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import ReadingStatusBadge from '../components/clubs/ReadingStatusBadge.jsx'
import JoinForm from '../components/join/JoinForm.jsx'
import JoinSummary from '../components/join/JoinSummary.jsx'
import { validateRequest } from '../domain/requestValidation.js'
import useConfirmAction from '../hooks/useConfirmAction.jsx'

const emptyDraft = {
  motivation: '',
  weeklyHours: '1',
  wantsReminders: false,
  experience: 'beginner',
  participationFormat: 'any',
  contactEmail: '',
}

const fieldOrder = [
  'motivation',
  'weeklyHours',
  'experience',
  'participationFormat',
  'contactEmail',
  'wantsReminders',
]

function toDraft(source) {
  return {
    motivation: source.motivation,
    weeklyHours: String(source.weeklyHours),
    wantsReminders: source.wantsReminders,
    experience: source.experience,
    participationFormat: source.participationFormat,
    contactEmail: source.contactEmail ?? '',
  }
}

export default function JoinPage({
  title, club, initialDraft = emptyDraft,
  onSave, onCancel, submitLabel, cancelLabel = 'Вийти без збереження',
}) {
  const initialValues = toDraft(initialDraft)
  const { ask, confirmation } = useConfirmAction()
  const [draft, setDraft] = useState(() => toDraft(initialDraft))
  const [touched, setTouched] = useState({})
  const [attempted, setAttempted] = useState(false)
  const [operationError, setOperationError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitting = useRef(false)
  const alive = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  const validation = validateRequest({ ...draft, clubId: club.id }, [club])
  const errors = Object.fromEntries(
    Object.entries(validation.errors).filter(([field]) => (
      attempted || touched[field]
    )),
  )
  const isDirty = fieldOrder.some((field) => draft[field] !== initialValues[field])

  function handleChange(field, value) {
    setDraft((previous) => ({ ...previous, [field]: value }))
    setOperationError('')
  }

  function handleBlur(field) {
    setTouched((previous) => ({ ...previous, [field]: true }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting.current) return
    setAttempted(true)
    setOperationError('')

    if (!validation.ok) {
      const firstField = fieldOrder.find((field) => validation.errors[field])
      if (firstField) event.currentTarget.elements.namedItem(firstField)?.focus()
      return
    }

    submitting.current = true
    setIsSubmitting(true)
    try {
      const result = await onSave(validation.value)
      if (!result.ok && alive.current) {
        setOperationError(
          result.errors
            ? Object.values(result.errors).join(' ')
            : result.message || 'Не вдалося зберегти заявку.',
        )
      }
    } catch {
      if (alive.current) setOperationError('Не вдалося завершити збереження.')
    } finally {
      submitting.current = false
      if (alive.current) setIsSubmitting(false)
    }
  }

  function handleReset() {
    if (submitting.current) return
    if (!isDirty) return
    ask({ title: 'Відкинути введені зміни?', description: 'Поля заявки повернуться до початкових значень.', action: () => {
      setDraft(toDraft(initialDraft)); setTouched({}); setAttempted(false); setOperationError('')
    } })
  }

  function handleCancel() {
    if (submitting.current) return
    if (isDirty) ask({ title: 'Відкинути незбережені зміни?', description: 'Введені зміни заявки не буде збережено.', action: onCancel })
    else onCancel()
  }

  return (
    <>
      <PageHeading title={title} />
      {confirmation}
      <Section id="join-editor" title="Поля та підсумок">
        <p><ReadingStatusBadge currentBook={club.currentBook} /></p>
        <div className="editor-layout">
          <JoinForm
            idPrefix="join-draft"
            clubName={club.name}
            draft={draft}
            errors={errors}
            operationError={operationError}
            isSubmitting={isSubmitting}
            onChange={handleChange}
            onBlur={handleBlur}
            onSubmit={handleSubmit}
            onReset={handleReset}
            submitLabel={submitLabel}
          />
          <JoinSummary clubName={club.name} draft={draft} />
        </div>
      </Section>
      <AppButton variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
        {cancelLabel}
      </AppButton>
    </>
  )
}
