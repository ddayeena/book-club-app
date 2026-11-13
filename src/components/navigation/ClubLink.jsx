import { Link, useLocation } from 'react-router'
import { clubNavigationTarget } from '../../domain/catalogNavigation.js'

// Preserve catalog context only on club-local links, never in the global menu.
export default function ClubLink({ to, ...props }) {
  const location = useLocation()
  return <Link {...props} to={clubNavigationTarget(to, location)} />
}
