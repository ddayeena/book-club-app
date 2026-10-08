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
    <div className="app-shell">
      <SiteHeader title="Книжкові клуби" links={navigationLinks} />
      <div className="app-content">
        <main id="main-content" tabIndex={-1}>
          <ClubSelectionProvider clubs={clubs}>
            <RequestsProvider>
              <Outlet />
            </RequestsProvider>
          </ClubSelectionProvider>
        </main>
        <footer>
          Навчальний проєкт «Книжкові клуби». Каталог, заявки на приєднання, обговорення.
        </footer>
      </div>
    </div>
  )
}