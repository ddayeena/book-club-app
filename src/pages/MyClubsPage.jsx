import { Link } from 'react-router'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import ClubCard from '../components/clubs/ClubCard.jsx'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'

export default function MyClubsPage() {
  const { user } = useAuth()
  const { clubs, status = 'success', error, reload } = useClubs()
  const mine = clubs.filter((club) => club.ownerId === user.id || club.isMember)
  const groups = [
    ['Створені мною', mine.filter((c) => !c.archivedAt && c.ownerId === user.id)],
    ['Участь в інших клубах', mine.filter((c) => !c.archivedAt && c.ownerId !== user.id)],
    ['Архівні клуби', mine.filter((c) => c.archivedAt)],
  ]
  return <div className="personal-page"><p className="eyebrow">Ваша читацька спільнота</p><PageHeading title="Мої клуби" />
    <p className="page-lead">Клуби, які ви створили, та спільноти, до яких приєдналися.</p>
    <nav className="personal-nav" aria-label="Особистий розділ"><Link to="/profile">Мій профіль</Link><Link to="/requests">Мої заявки</Link><Link to="/clubs/new">Створити клуб</Link></nav>
    <div className="page-toolbar"><AppButton variant="secondary" disabled={status === 'loading'} onClick={() => void reload()}>Оновити клуби</AppButton></div>
    {status === 'loading' && <p role="status">Завантаження ваших клубів…</p>}
    {status === 'error' && <p role="alert" className="form-alert">{error}</p>}
    {status === 'success' && groups.map(([title, records]) => <section className="my-clubs-section" key={title} aria-label={title}>
      <h2>{title} <span className="personal-count">{records.length}</span></h2>
      {records.length ? <ul className="my-clubs-list">{records.map((club) => <li key={club.id}>
        {club.archivedAt && <p className="field-hint">Архівний клуб · <span className="meta-tag">{club.ownerId === user.id ? 'Власник' : club.isMember ? 'Учасник' : null}</span></p>}
        <ClubCard club={club} isOwn={club.ownerId === user.id} showSelection={false} />
      </li>)}</ul> : <p className="empty-state">{title === 'Архівні клуби' ? 'Архівних клубів поки немає.' : title === 'Створені мною' ? 'У вас поки немає активних створених клубів. Архівовані клуби можна переглянути в розділі "Архівні".' : 'У вас поки немає активних членств в інших клубах. Архівовані клуби можна переглянути в розділі "Архівні".'}</p>}
    </section>)}
    <p><Link to="/clubs">Знайти новий клуб у каталозі</Link></p>
  </div>
}
