import { Link } from 'react-router'
import AppButton from '../ui/AppButton.jsx'
import {
  experienceOptions,
  optionLabel,
  participationOptions,
} from '../../domain/options.js'
import { formatCreatedAt } from '../../domain/dates.js'

export default function RequestTable({ requests, clubs, onDelete, isMutating = false }) {
  return (
    <div className="table-scroll">
      <table className="requests-table">
        <caption>Заявки на приєднання</caption>
        <thead>
          <tr>
            <th scope="col">Клуб і мотивація</th>
            <th scope="col">Профіль</th>
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
                  <p className="row-date">Створено: {formatCreatedAt(request.createdAt)}</p>
                </td>
                <td>
                  <span className="chip-static">
                    {optionLabel(experienceOptions, request.experience)}
                  </span>
                  <span className="chip-static chip-alt">
                    {optionLabel(participationOptions, request.participationFormat)}
                  </span>
                  {request.contactEmail && (
                    <p className="row-date">{request.contactEmail}</p>
                  )}
                </td>
                <td>{request.weeklyHours}</td>
                <td>{request.wantsReminders ? 'Так' : 'Ні'}</td>
                <td>
                  <div className="row-actions">
                    <Link to={path} className="link-inline">Переглянути</Link>
                    <Link to={`${path}/edit`} className="link-inline">Редагувати</Link>
                    <AppButton
                      variant="secondary"
                      disabled={isMutating}
                      onClick={() => onDelete(request)}
                    >
                      Видалити
                    </AppButton>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}