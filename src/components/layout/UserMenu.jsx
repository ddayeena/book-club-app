import { Link, useNavigate } from 'react-router'
import useAuth from '../../hooks/useAuth.js'
import { initials } from '../../domain/people.js'

export default function UserMenu() {
  const { user } = useAuth()
  const navigate = useNavigate()

  if (!user) {
    return (
      <div className="user-menu">
        <Link to="/login" className="text-link">Увійти</Link>
        <Link to="/register" className="pill-link">Реєстрація</Link>
      </div>
    )
  }

  function handleLogout() {
    navigate('/logout')
  }

  return (
    <div className="user-menu">
      <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
      <span className="user-name">{user.name}</span>
      <button type="button" className="text-button" onClick={handleLogout}>
        Вийти
      </button>
    </div>
  )
}
