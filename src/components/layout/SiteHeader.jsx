import { Link } from 'react-router'
import MainNav from '../navigation/MainNav.jsx'
import UserMenu from './UserMenu.jsx'
import useAuth from '../../hooks/useAuth.js'
import NotificationBell from '../notifications/NotificationBell.jsx'

export default function SiteHeader() {
  const { user } = useAuth()
  const links = [
    { to: '/', label: 'Головна', end: true },
    { to: '/clubs', label: 'Клуби' },
    ...(user ? [{ to: '/requests', label: 'Мої заявки' }] : []),
  ]

  return (
    <header className="masthead">
      <div className="masthead-inner">
        <Link to="/" className="wordmark" aria-label="ReadHub: на головну">
          <span className="wordmark-mark" aria-hidden="true">
            <i /><i /><i />
          </span>
          <span className="wordmark-text"><em>ReadHub</em></span>
        </Link>
        <MainNav links={links} />
        <div className="header-account">{user && <NotificationBell />}<UserMenu /></div>
      </div>
      <div className="masthead-stripe" aria-hidden="true">
        <i /><i /><i /><i /><i /><i />
      </div>
    </header>
  )
}
