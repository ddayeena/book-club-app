import Section from '../components/ui/Section.jsx'
import CatalogSummary from '../components/clubs/CatalogSummary.jsx'
import ClubFilters from '../components/clubs/ClubFilters.jsx'
import ClubList from '../components/clubs/ClubList.jsx'
import useClubFilters from '../hooks/useClubFilters.js'

export default function HomePage({ clubs, selectedId, onSelect }) {
  const {
    query,
    setQuery,
    readingOnly,
    setReadingOnly,
    visibleClubs,
    resetFilters,
  } = useClubFilters(clubs)

  return (
    <>
      <Section id="about" title="Про застосунок">
        <p>Платформа для організації спільного читання й обговорень.</p>
        <p>Перегляньте каталог книжкових клубів і оберіть той, що відповідає вашим інтересам.</p>
      </Section>
      <Section id="catalog" title="Клуби">
        <CatalogSummary total={clubs.length} />
        <ClubFilters
          query={query}
          readingOnly={readingOnly}
          onQueryChange={setQuery}
          onReadingOnlyChange={setReadingOnly}
          onReset={resetFilters}
        />
        <p>Показано клубів: {visibleClubs.length}</p>
        <ClubList
          clubs={visibleClubs}
          selectedId={selectedId}
          onSelect={onSelect}
          emptyTitle={clubs.length === 0
            ? 'Клубів ще не додано.'
            : 'За цими фільтрами нічого не знайдено.'}
        />
        <p><a href="#join">Перейти до заявки на приєднання</a></p>
      </Section>
    </>
  )
}