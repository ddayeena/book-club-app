import { Link } from 'react-router'
import AppButton from '../ui/AppButton.jsx'

export default function RequestTable({ requests, clubs, onDelete }) {
  return (
    <div className="table-scroll">
      <table className="requests-table">
        <caption>Заявки поточної локальної колекції</caption>
        <thead>
          <tr>
            <th scope="col">Клуб і мотивація</th>
            <th scope="col">Годин/тиждень</th>
            <th scope="col">Нагадування</th>
            <th scope="col">Дії</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => {
            const club = clubs.find((entry) => entry.id === request.clubId)
            const path = `/requests/${encodeURIComponent(request.id)}`
            return (
              <tr key={request.id}>
                <td>
                  <strong>{club?.name ?? 'Клуб відсутній'}</strong>
                  <p>{request.motivation}</p>
                </td>
                <td>{request.weeklyHours}</td>
                <td>{request.wantsReminders ? 'Так' : 'Ні'}</td>
                <td>
                  <p><Link to={path}>Переглянути</Link></p>
                  <p><Link to={`${path}/edit`}>Редагувати</Link></p>
                  <AppButton variant="secondary" onClick={() => onDelete(request)}>
                    Видалити
                  </AppButton>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}