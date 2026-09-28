import { useState } from 'react'
import PageHeading from '../components/ui/PageHeading.jsx'
import Section from '../components/ui/Section.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import ReadingStatusBadge from '../components/clubs/ReadingStatusBadge.jsx'
import JoinForm from '../components/join/JoinForm.jsx'
import JoinSummary from '../components/join/JoinSummary.jsx'

const emptyDraft = { motivation: '', wantsReminders: false }

export default function JoinPage({
  title,
  club,
  initialDraft = emptyDraft,
  onCancel,
  cancelLabel = 'Вийти без збереження',
}) {
  const [draft, setDraft] = useState(() => ({ ...initialDraft }))

  function handleMotivationChange(motivation) {
    setDraft((previous) => ({ ...previous, motivation }))
  }

  function handleWantsRemindersChange(wantsReminders) {
    setDraft((previous) => ({ ...previous, wantsReminders }))
  }

  function handleReset() {
    setDraft({ ...emptyDraft })
  }

  return (
    <>
      <PageHeading title={title} />
      <Section id="join" title="Поля та підсумок">
        <p>
          Клуб «{club.name}»:{' '}
          <ReadingStatusBadge currentBook={club.currentBook} />
        </p>
        <JoinForm
          idPrefix="join-draft"
          clubName={club.name}
          draft={draft}
          onMotivationChange={handleMotivationChange}
          onWantsRemindersChange={handleWantsRemindersChange}
          onReset={handleReset}
        />
        <JoinSummary clubName={club.name} draft={draft} />
      </Section>
      <AppButton variant="secondary" onClick={onCancel}>
        {cancelLabel}
      </AppButton>
    </>
  )
}