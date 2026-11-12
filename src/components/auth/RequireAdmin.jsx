import { Navigate, Outlet, useLocation } from 'react-router'
import useAuth from '../../hooks/useAuth.js'

export default function RequireAdmin() {
  const { user, status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <p role="status">Перевірка прав доступу…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: { pathname: location.pathname, search: location.search } }} />
  if (user.role !== 'admin') return <section className="state-banner"><h1>Немає доступу</h1><p>Цей розділ доступний лише адміністраторам.</p></section>
  return <Outlet />
}
