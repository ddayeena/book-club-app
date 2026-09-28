import { Link } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'

export default function NotFoundPage({
  title = '404: сторінку не знайдено',
  message = 'Перевірте адресу або перейдіть до каталогу.',
}) {
  return (
    <>
      <PageHeading title={title} />
      <p>{message}</p>
      <p><Link to="/clubs">Відкрити каталог</Link></p>
      <p><Link to="/">На головну</Link></p>
    </>
  )
}