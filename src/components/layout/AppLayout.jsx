import { Outlet } from 'react-router'
import SiteHeader from './SiteHeader.jsx'
import ClubSelectionProvider from '../../providers/ClubSelectionProvider.jsx'

const navigationLinks = [
  { to: '/', label: 'Головна', end: true },
  { to: '/clubs', label: 'Клуби' },
  { to: '/requests', label: 'Заявки' },
]

export default function AppLayout({ clubs }) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Перейти до вмісту
      </a>
      <SiteHeader title="Книжкові клуби" links={navigationLinks} />
      <main id="main-content" tabIndex={-1}>
        <ClubSelectionProvider clubs={clubs}>
          <Outlet />
        </ClubSelectionProvider>
      </main>
      <footer>Навчальний проєкт. Каталог клубів і підготовка заявки на приєднання.</footer>
    </>
  )
}