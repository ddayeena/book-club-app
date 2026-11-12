import { Link, Outlet, useLocation } from 'react-router'
import SiteHeader from './SiteHeader.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import ClubsProvider from '../../providers/ClubsProvider.jsx'
import ClubSelectionProvider from '../../providers/ClubSelectionProvider.jsx'
import RequestsProvider from '../../providers/RequestsProvider.jsx'
import useAuth from '../../hooks/useAuth.js'
import ClubsGate from '../clubs/ClubsGate.jsx'
import NotificationsProvider from '../../providers/NotificationsProvider.jsx'

function Shell() {
  const { user } = useAuth()
  const location = useLocation()
  const profilePage = /^\/(profile|notifications)\/?$/.test(location.pathname)

  return (
    <div className="site">
      <SiteHeader />
      {/* Інший користувач означає іншу колекцію заявок, тому провайдер створюється заново. */}
      <ContentProviders profilePage={profilePage} userId={user?.id ?? 'guest'}>
        <main id="main-content" tabIndex={-1}>
          <ErrorBoundary resetKey={location.pathname}>
            {profilePage || location.pathname.replace(/\/$/, '') === '/my-clubs' || ['/login', '/register', '/logout'].includes(location.pathname)
              ? <Outlet />
              : <ClubsGate><Outlet /></ClubsGate>}
          </ErrorBoundary>
        </main>
      </ContentProviders>
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
  const { pathname } = useLocation()
  return <NotificationsProvider>{/^\/(profile|notifications)\/?$/.test(pathname) ? <Shell />
    : <ClubsProvider><ClubSelectionProvider><Shell /></ClubSelectionProvider></ClubsProvider>}</NotificationsProvider>
}
function ContentProviders({ profilePage, userId, children }) {
  return profilePage ? children : <RequestsProvider key={userId}>{children}</RequestsProvider>
}
