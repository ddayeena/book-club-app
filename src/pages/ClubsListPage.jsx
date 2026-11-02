import { Link, useLocation } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'
import ClubFilters from '../components/clubs/ClubFilters.jsx'
import ClubList from '../components/clubs/ClubList.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import useClubFilters from '../hooks/useClubFilters.js'
import useClubSelection from '../hooks/useClubSelection.js'

export default function ClubsListPage() {
  const { clubs } = useClubs()
  const { user } = useAuth()
  const { selectedId, selectClub } = useClubSelection()
  const filters = useClubFilters(clubs)
  const location = useLocation()
  const notice = location.state?.notice
  const requestSearch = selectedId
    ? `?${new URLSearchParams({ clubId: selectedId })}`
    : ''

  return (
    <>
      <div className="page-head">
        <div>
          <PageHeading title="Каталог клубів" />
          <p className="page-lead">
            Знайдіть клуб за жанром, форматом і книгою, яку він читає, або створіть власний.
          </p>
        </div>
        {user ? (
          <Link to="/clubs/new" className="link-button">Створити клуб</Link>
        ) : (
          <Link
            to="/login"
            state={{ from: { pathname: '/clubs/new', search: '' } }}
            className="link-button link-button-secondary"
          >
            Увійти, щоб створити клуб
          </Link>
        )}
      </div>

      {notice && <p role="status" className="flash">{notice}</p>}

      <div className="catalog-layout">
        <aside className="catalog-aside">
          <ClubFilters
            query={filters.query}
            readingOnly={filters.readingOnly}
            mine={filters.mine}
            canFilterMine={Boolean(user)}
            format={filters.format}
            genre={filters.genre}
            sort={filters.sort}
            genres={filters.genres}
            onQueryChange={filters.setQuery}
            onReadingOnlyChange={filters.setReadingOnly}
            onMineChange={filters.setMine}
            onFormatChange={filters.setFormat}
            onGenreChange={filters.setGenre}
            onSortChange={filters.setSort}
            onReset={filters.resetFilters}
          />
        </aside>

        <section className="catalog-results" aria-label="Результати пошуку">
          <p role="status" className="results-count">
            Показано клубів: {filters.visibleClubs.length}
          </p>
          <ClubList
            clubs={filters.visibleClubs}
            selectedId={selectedId}
            onSelect={selectClub}
            currentUserId={user?.id ?? null}
            emptyTitle={clubs.length === 0
              ? 'Клубів ще не додано.'
              : 'За цими фільтрами нічого не знайдено.'}
          />
          <p className="results-footer">
            <Link to={`/requests/new${requestSearch}`} className="link-inline">
              Підготувати заявку на приєднання
            </Link>
          </p>
        </section>
      </div>
    </>
  )
}
