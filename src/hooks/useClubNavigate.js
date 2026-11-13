import { useLocation, useNavigate } from 'react-router'
import { clubNavigationTarget } from '../domain/catalogNavigation.js'

export default function useClubNavigate() {
  const navigate = useNavigate(), location = useLocation()
  return (to, options) => navigate(typeof to === 'number' ? to : clubNavigationTarget(to, location), options)
}
