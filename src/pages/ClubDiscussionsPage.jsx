import { useSearchParams } from 'react-router'
import Link from '../components/navigation/ClubLink.jsx'
import DiscussionScope from '../components/discussions/DiscussionScope.jsx'
import DiscussionCard from '../components/discussions/DiscussionCard.jsx'
import DiscussionPagination from '../components/discussions/DiscussionPagination.jsx'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import useDiscussionResource from '../hooks/useDiscussionResource.js'

function List({ club }) {
  const [params, setParams] = useSearchParams(), bookId = params.get('book') || null
  const raw = Number(params.get('page') ?? 1), page = Number.isInteger(raw) && raw > 0 && raw <= 1000000 ? raw : 1
  const { data, error, reload } = useDiscussionResource('list', club.id, null, page, bookId)
  const search = `?${params.toString()}`
  return <div className="discussions-page"><p className="breadcrumb"><Link to={`/clubs/${club.id}`}>{club.name}</Link> / Обговорення</p><PageHeading title={`Обговорення: ${club.name}`} />
    {club.archivedAt && <p className="flash">Архівний клуб: лише читання.</p>}
    <div className="page-toolbar">{data?.list.can_create && <Link className="link-button" to={`/clubs/${club.id}/discussions/new${search}`}>Створити тему</Link>}<AppButton variant="secondary" onClick={reload}>Оновити обговорення</AppButton></div>
    {error && <p className="form-alert" role="alert">{error}</p>}{!data && !error && <p role="status">Завантаження обговорень…</p>}
    {data && <><label htmlFor="discussion-filter">Книга</label><select id="discussion-filter" value={bookId ?? ''} onChange={(e) => { const next = new URLSearchParams(params); if (e.target.value) next.set('book', e.target.value); else next.delete('book'); next.set('page', '1'); setParams(next) }}><option value="">Усі книги й загальні теми</option>{data.books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select>
      {data.list.items.length ? <ul className="discussion-list">{data.list.items.map((topic) => <li key={topic.id}><DiscussionCard topic={topic} search={search} /></li>)}</ul> : <p className="empty-state">{page > 1 ? 'На цій сторінці тем немає. Поверніться на попередню.' : 'Обговорень поки немає. Створіть першу тему, якщо маєте право участі.'}</p>}
      <DiscussionPagination page={page} total={data.list.total} onChange={(next) => { const query = new URLSearchParams(params); query.set('page', String(next)); setParams(query) }} /></>}
  </div>
}
export default function ClubDiscussionsPage() { return <DiscussionScope>{(club) => <List club={club} />}</DiscussionScope> }
