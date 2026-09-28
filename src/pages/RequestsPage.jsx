import { Link } from 'react-router'
import PageHeading from '../components/ui/PageHeading.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'

export default function RequestsPage({ requests, clubs }) {
  return (
    <>
      <PageHeading title="Заявки на приєднання" />
      <p>Нижче наведено локальні демонстраційні записи.</p>
      {requests.length === 0 ? (
        <EmptyState title="Заявок ще немає.">
          <p><Link to="new">Підготувати нову заявку</Link></p>
        </EmptyState>
      ) : (
        <div className="table-scroll">
          <table className="requests-table">
            <caption>Заявки для перевірки навігації</caption>
            <thead>
              <tr>
                <th scope="col">Клуб</th>
                <th scope="col">Мотивація</th>
                <th scope="col">Дія</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const club = clubs.find((entry) => entry.id === request.clubId)

                return (
                  <tr key={request.id}>
                    <td>{club?.name ?? 'Клуб відсутній у каталозі'}</td>
                    <td>{request.motivation}</td>
                    <td>
                      <Link to={`${encodeURIComponent(request.id)}/edit`}>
                        Редагувати {request.id}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}