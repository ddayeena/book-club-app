import { Link } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'
import Section from '../components/ui/Section.jsx'
import CatalogSummary from '../components/clubs/CatalogSummary.jsx'
import ClubFilters from '../components/clubs/ClubFilters.jsx'
import ClubList from '../components/clubs/ClubList.jsx'
import useClubFilters from '../hooks/useClubFilters.js'

export default function ClubsListPage({ clubs, selectedId, onSelect }) {
  const {
    query,
    setQuery,
    readingOnly,
    setReadingOnly,
    visibleClubs,
    resetFilters,
  } = useClubFilters(clubs)
  const requestSearch = selectedId
    ? `?${new URLSearchParams({ clubId: selectedId })}`
    : ''

  return (
    <>
      <PageHeading title="Каталог клубів" />
      <Section id="catalog" title="Пошук і вибір">
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
        <p>
          <Link to={`/requests/new${requestSearch}`}>
            Підготувати заявку на приєднання
          </Link>
        </p>
      </Section>
    </>
  )
}