import { Link } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'

export default function NotFoundPage({
  title = '404: сторінку не знайдено',
  message = 'Перевірте адресу або перейдіть до каталогу.',
}) {
  return (
    <div className="narrow">
      <PageHeading title={title} />
      <p className="page-lead">{message}</p>
      <div className="page-toolbar">
        <Link to="/clubs" className="link-button">Відкрити каталог</Link>
        <Link to="/" className="link-inline">На головну</Link>
      </div>
    </div>
  )
}
