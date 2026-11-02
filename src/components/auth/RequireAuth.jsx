import { Navigate, Outlet, useLocation } from 'react-router'
import useAuth from '../../hooks/useAuth.js'

export default function RequireAuth() {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: { pathname: location.pathname, search: location.search } }}
      />
    )
  }

  return <Outlet />
}
