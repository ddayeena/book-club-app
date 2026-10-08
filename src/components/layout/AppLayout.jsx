import { Outlet } from 'react-router'
import SiteHeader from './SiteHeader.jsx'
import ClubSelectionProvider from '../../providers/ClubSelectionProvider.jsx'
import RequestsProvider from '../../providers/RequestsProvider.jsx'

const navigationLinks = [
  { to: '/', label: 'Головна', end: true },
  { to: '/clubs', label: 'Клуби' },
  { to: '/requests', label: 'Заявки' },
]

export default function AppLayout({ clubs }) {
  return (
    <>
      <SiteHeader title="Книжкові клуби" links={navigationLinks} />

      <main id="main-content" tabIndex={-1}>
        <ClubSelectionProvider clubs={clubs}>
          <RequestsProvider>
            <Outlet />
          </RequestsProvider>
        </ClubSelectionProvider>
      </main>
      <footer>
        <div className="footer-inner">
          Навчальний проєкт. Каталог клубів і підготовка заявки на приєднання.
        </div>
      </footer>
    </>
  )
}