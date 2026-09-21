import AppLayout from './components/layout/AppLayout.jsx'
import HomePage from './pages/HomePage.jsx'
import JoinPage from './pages/JoinPage.jsx'
import { clubs } from './data/clubs.js'

const navigationLinks = [
  { href: '#about', label: 'Про застосунок' },
  { href: '#catalog', label: 'Клуби' },
  { href: '#join', label: 'Заявка на приєднання' },
]

export default function App() {
  const exampleClub = clubs.find((club) => club.id === 'club-001')

  return (
    <AppLayout title="Книжкові клуби" links={navigationLinks}>
      <HomePage />
      <JoinPage club={exampleClub} />
    </AppLayout>
  )
}