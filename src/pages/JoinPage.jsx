import Section from '../components/ui/Section.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import ReadingStatusBadge from '../components/clubs/ReadingStatusBadge.jsx'
import JoinFormPreview from '../components/meetings/JoinFormPreview.jsx'

export default function JoinPage({ club }) {
  return (
    <Section id="join" title="Заявка на приєднання">
      {club ? (
        <>
          <p>
            Приклад для клубу «{club.name}»:{' '}
            <ReadingStatusBadge currentBook={club.currentBook} />
          </p>
          <JoinFormPreview idPrefix="join-preview" clubName={club.name} />
        </>
      ) : (
        <EmptyState title="Немає клубу для макета заявки.">
          <p><a href="#catalog">Переглянути каталог</a></p>
        </EmptyState>
      )}
    </Section>
  )
}