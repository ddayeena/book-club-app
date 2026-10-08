import MainNav from '../navigation/MainNav.jsx'

export default function SiteHeader({ title, links }) {
  return (
    <header className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">📖</span>
        <span className="brand-name">{title}</span>
      </div>
      <MainNav links={links} />
      <p className="sidebar-note">Читаємо разом. Обговорюємо щомісяця.</p>
    </header>
  )
}