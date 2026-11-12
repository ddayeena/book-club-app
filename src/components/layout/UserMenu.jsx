import { Link, useNavigate } from 'react-router'
import useAuth from '../../hooks/useAuth.js'
import UserAvatar from '../profile/UserAvatar.jsx'
import { useEffect, useRef, useState } from 'react'

export default function UserMenu() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const profile = useRef(null)
  const [profileOpen, setProfileOpen] = useState(false)
  useEffect(() => {
    const dismiss = (event) => { if (!profile.current?.contains(event.target)) setProfileOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])

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
      <div className="profile-menu" ref={profile} onKeyDown={(event) => {
        if (event.key === 'Escape') { setProfileOpen(false); profile.current.querySelector('button')?.focus() }
      }}>
        <button type="button" className="profile-trigger" aria-label="Меню профілю" aria-expanded={profileOpen}
          aria-controls="profile-menu-panel" onClick={() => setProfileOpen((value) => !value)}>
          <UserAvatar user={user} />
          <span className="user-name">{user.name}</span><span aria-hidden="true">⌄</span></button>
        {profileOpen && <div id="profile-menu-panel" className="profile-menu-panel"><p>Користувач ReadHub</p>
          <Link to="/profile" onClick={() => setProfileOpen(false)}>Мій профіль</Link>
          <Link to="/my-clubs" onClick={() => setProfileOpen(false)}>Мої клуби</Link>
        </div>}
      </div>
      <button type="button" className="text-button" onClick={handleLogout}>
        Вийти
      </button>
    </div>
  )
}
