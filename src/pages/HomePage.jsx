import { Link } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'

export default function HomePage() {
  return (
    <>
      <PageHeading title="Книжкові клуби" />
      <p>Платформа для організації спільного читання й обговорень.</p>
      <p>Перегляньте каталог клубів і підготуйте чернетку заявки на приєднання.</p>
      <p><Link to="/clubs">Перейти до каталогу клубів</Link></p>
      <p><Link to="/requests">Переглянути демонстраційні заявки</Link></p>
    </>
  )
}