import PageLoading from './PageLoading.jsx'
import { Suspense, useEffect, useRef } from 'react'
import { Link, Outlet, useLocation, useNavigationType } from 'react-router'
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
      <a className="site-skip" href="#main-content" onClick={(event) => {
        event.preventDefault()
        document.getElementById('main-content')?.focus()
      }}>Перейти до вмісту</a>
      <SiteHeader />
      {/* Інший користувач означає іншу колекцію заявок, тому провайдер створюється заново. */}
      <ContentProviders profilePage={profilePage} userId={user?.id ?? 'guest'}>
        <main id="main-content" tabIndex={-1}>
          <ErrorBoundary resetKey={location.pathname}><Suspense fallback={<PageLoading />}>
            {profilePage || location.pathname.replace(/\/$/, '') === '/my-clubs' || ['/login', '/register', '/logout'].includes(location.pathname)
              ? <Outlet />
              : <ClubsGate><Outlet /></ClubsGate>}
          </Suspense></ErrorBoundary>
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
  const navigationType = useNavigationType()
  const previousPath = useRef(pathname)
  useEffect(() => {
    const changed = previousPath.current !== pathname
    previousPath.current = pathname
    // Query-only updates and history traversal retain their existing focus/scroll.
    // Focus the stable main landmark even when its page is still loading.
    if (changed && navigationType !== 'POP' && !document.querySelector('dialog[open]')) {
      document.getElementById('main-content')?.focus({ preventScroll: true })
    }
  }, [pathname, navigationType])
  return <NotificationsProvider>{/^\/(profile|notifications)\/?$/.test(pathname) ? <Shell />
    : <ClubsProvider><ClubSelectionProvider><Shell /></ClubSelectionProvider></ClubsProvider>}</NotificationsProvider>
}
function ContentProviders({ profilePage, userId, children }) {
  const { pathname } = useLocation()
  const needsRequests = pathname === '/' || /^\/requests(?:\/|$)/.test(pathname)
    || /^\/clubs\/[^/]+\/?$/.test(pathname) && pathname.replace(/\/$/, '') !== '/clubs/new'
  return profilePage ? children : <RequestsProvider key={userId} enabled={needsRequests}>{children}</RequestsProvider>
}
