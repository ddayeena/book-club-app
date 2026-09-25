import AppLayout from './components/layout/AppLayout.jsx'
import ClubSelectionProvider from './providers/ClubSelectionProvider.jsx'
import CatalogContainer from './pages/CatalogContainer.jsx'
import JoinContainer from './pages/JoinContainer.jsx'
import { clubs } from './data/clubs.js'

const navigationLinks = [
  { href: '#about', label: 'Про застосунок' },
  { href: '#catalog', label: 'Клуби' },
  { href: '#join', label: 'Заявка на приєднання' },
]

export default function App() {
  return (
    <AppLayout title="Книжкові клуби" links={navigationLinks}>
      <ClubSelectionProvider clubs={clubs}>
        <CatalogContainer clubs={clubs} />
        <JoinContainer />
      </ClubSelectionProvider>
    </AppLayout>
  )
}