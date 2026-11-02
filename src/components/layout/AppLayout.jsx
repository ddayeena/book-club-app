import { Link, Outlet, useLocation } from 'react-router'
import SiteHeader from './SiteHeader.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import AuthProvider from '../../providers/AuthProvider.jsx'
import ClubsProvider from '../../providers/ClubsProvider.jsx'
import ClubSelectionProvider from '../../providers/ClubSelectionProvider.jsx'
import RequestsProvider from '../../providers/RequestsProvider.jsx'
import useAuth from '../../hooks/useAuth.js'

function Shell() {
  const { user } = useAuth()
  const location = useLocation()

  return (
    <div className="site">
      <SiteHeader />
      {/* Інший користувач означає іншу колекцію заявок, тому провайдер створюється заново. */}
      <RequestsProvider key={user?.id ?? 'guest'}>
        <main id="main-content" tabIndex={-1}>
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </RequestsProvider>
      <footer className="site-footer">
        <div className="site-footer-inner">
          <p>ReadHub. Навчальний проєкт: клуби, заявки, обговорення.</p>
          <p>
            <Link to="/clubs">Каталог</Link>
            <span aria-hidden="true"> · </span>
            <Link to="/">Головна</Link>
          </p>
        </div>
      </footer>
    </div>
  )
}

export default function AppLayout() {
  return (
    <AuthProvider>
      <ClubsProvider>
        <ClubSelectionProvider>
          <Shell />
        </ClubSelectionProvider>
      </ClubsProvider>
    </AuthProvider>
  )
}
