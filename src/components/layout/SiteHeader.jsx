import { Link } from 'react-router'
import MainNav from '../navigation/MainNav.jsx'

export default function SiteHeader({ title, links }) {
  return (
    <header className="site-header">
      <Link className="site-title" to="/">{title}</Link>
      <MainNav links={links} />
    </header>
  )
}