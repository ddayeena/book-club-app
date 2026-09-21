import { clubs } from '../data/clubs.js'
import Section from '../components/ui/Section.jsx'
import CatalogSummary from '../components/clubs/CatalogSummary.jsx'
import ClubList from '../components/clubs/ClubList.jsx'

export default function HomePage() {
  return (
    <>
      <Section id="about" title="Про застосунок">
        <p>Платформа для організації спільного читання й обговорень.</p>
        <p>Перегляньте каталог книжкових клубів і оберіть той, що відповідає вашим інтересам.</p>
      </Section>

      <Section id="catalog" title="Клуби">
        <CatalogSummary total={clubs.length} />
        <ClubList clubs={clubs} />
      </Section>
    </>
  )
}