import { Link } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'
import CatalogStats from '../components/clubs/CatalogStats.jsx'
import Section from '../components/ui/Section.jsx'

export default function HomePage({ clubs }) {
  return (
    <>
      <PageHeading title="Книжкові клуби" />

      <Section id="about" title="Про застосунок">
        <p>Платформа для організації спільного читання й обговорень.</p>
        <p>Перегляньте каталог книжкових клубів і оберіть той, що відповідає вашим інтересам.</p>
        <CatalogStats clubs={clubs} />
      </Section>

      <p><Link to="/clubs">Перейти до каталогу клубів</Link></p>
      <p><Link to="/requests">Переглянути демонстраційні заявки</Link></p>


    </>
  )
}