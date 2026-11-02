import { NavLink } from 'react-router'

export default function MainNav({ links }) {
  return (
    <nav className="main-nav" aria-label="Основна навігація">
      <ul>
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.end}
              className={({ isActive }) => (
                isActive ? 'main-nav-link active' : 'main-nav-link'
              )}
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
