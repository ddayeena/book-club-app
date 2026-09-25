import { useEffect, useState } from 'react'
import Section from '../components/ui/Section.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import ReadingStatusBadge from '../components/clubs/ReadingStatusBadge.jsx'
import JoinForm from '../components/join/JoinForm.jsx'
import JoinSummary from '../components/join/JoinSummary.jsx'

function createEmptyDraft() {
  return { motivation: '', wantsReminders: false }
}

export default function JoinPage({ club, onClearSelection }) {
  const [draft, setDraft] = useState(createEmptyDraft)
  const title = club ? `Книжкові клуби: ${club.name}` : 'Книжкові клуби'

  useEffect(() => {
    const previousTitle = document.title
    document.title = title

    return () => {
      document.title = previousTitle
    }
  }, [title])

  function handleMotivationChange(motivation) {
    setDraft((previous) => ({ ...previous, motivation }))
  }

  function handleWantsRemindersChange(wantsReminders) {
    setDraft((previous) => ({ ...previous, wantsReminders }))
  }

  function handleReset() {
    setDraft(createEmptyDraft())
  }

  if (!club) {
    return (
      <Section id="join" title="Заявка на приєднання">
        <EmptyState title="Клуб ще не вибрано.">
          <p><a href="#catalog">Виберіть клуб у каталозі</a></p>
        </EmptyState>
      </Section>
    )
  }

  return (
    <Section id="join" title="Заявка на приєднання">
      <p>
        Обрано «{club.name}»:{' '}
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
      <AppButton variant="secondary" onClick={onClearSelection}>
        Скасувати вибір і очистити чернетку
      </AppButton>
    </Section>
  )
}