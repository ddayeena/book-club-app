import MainNav from '../navigation/MainNav.jsx'

export default function SiteHeader({ title, links }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <h1>{title}</h1>
        <MainNav links={links} />
      </div>
    </header>
  )
}