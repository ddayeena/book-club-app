import { NavLink, Outlet } from 'react-router'
import RequestNotice from '../requests/RequestNotice.jsx'
import RequestsGate from '../requests/RequestsGate.jsx'

export default function RequestsLayout() {
  return (
    <>
      <nav aria-label="Навігація розділом заявок">
        <ul className="nav-list">
          <li><NavLink to="." end>Список заявок</NavLink></li>
          <li><NavLink to="new">Нова заявка</NavLink></li>
        </ul>
      </nav>
      <RequestNotice />
      <RequestsGate>
        <Outlet />
      </RequestsGate>
    </>
  )
}