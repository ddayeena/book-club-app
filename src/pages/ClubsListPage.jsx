import { Link } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'
import Section from '../components/ui/Section.jsx'
import CatalogSummary from '../components/clubs/CatalogSummary.jsx'
import ClubFilters from '../components/clubs/ClubFilters.jsx'
import ClubList from '../components/clubs/ClubList.jsx'
import useClubFilters from '../hooks/useClubFilters.js'

export default function ClubsListPage({ clubs, selectedId, onSelect }) {
  const filters = useClubFilters(clubs)
  const requestSearch = selectedId
    ? `?${new URLSearchParams({ clubId: selectedId })}`
    : ''

  return (
    <>
      <PageHeading title="Каталог клубів" />
      <Section id="catalog" title="Пошук і вибір">
        <CatalogSummary total={clubs.length} />
        <ClubFilters
          query={filters.query}
          readingOnly={filters.readingOnly}
          format={filters.format}
          genre={filters.genre}
          sort={filters.sort}
          genres={filters.genres}
          onQueryChange={filters.setQuery}
          onReadingOnlyChange={filters.setReadingOnly}
          onFormatChange={filters.setFormat}
          onGenreChange={filters.setGenre}
          onSortChange={filters.setSort}
          onReset={filters.resetFilters}
        />
        <p role="status">Показано клубів: {filters.visibleClubs.length}</p>
        <ClubList
          clubs={filters.visibleClubs}
          selectedId={selectedId}
          onSelect={onSelect}
          emptyTitle={clubs.length === 0
            ? 'Клубів ще не додано.'
            : 'За цими фільтрами нічого не знайдено.'}
        />
        <p>
          <Link to={`/requests/new${requestSearch}`} className="link-inline">
            Підготувати заявку на приєднання
          </Link>
        </p>
      </Section>
    </>
  )
}