import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import useAuth from '../hooks/useAuth.js'
import PageHeading from '../components/ui/PageHeading.jsx'
import AppButton from '../components/ui/AppButton.jsx'
import ProfileForm from '../components/profile/ProfileForm.jsx'
import { profileService } from '../services/profileService.js'
import { errorMessage } from '../services/ServiceError.js'

function Profile({ user }) {
  const { refreshAccess } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [revision, setRevision] = useState(0)
  const lock = useRef(false)
  const alive = useRef(false)
  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    profileService.get({ signal: controller.signal }).then((record) => {
      if (!controller.signal.aborted) { setProfile(record); setLoading(false) }
    }).catch((cause) => { if (!controller.signal.aborted) { setError(errorMessage(cause)); setLoading(false) } })
    return () => { alive.current = false; controller.abort() }
  }, [attempt])
  async function save(draft, options) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const result = await profileService.save(draft, { ...options, previousAvatar: profile.avatarPath })
      if (!alive.current) return
      setProfile(result.profile); setRevision((v) => v + 1); setNotice(result.warning || 'Профіль збережено.')
      await refreshAccess()
    } catch (cause) { if (alive.current) { setError(errorMessage(cause)); if (cause.code === '42501') void refreshAccess() } }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  function reload() { if (!lock.current) { setError(''); setProfile(null); setLoading(true); setAttempt((v) => v + 1) } }
  const registered = user.registeredAt || profile?.createdAt
  return <div className="personal-page"><p className="eyebrow">Ваша читацька сторінка</p><PageHeading title="Мій профіль" />
    <p className="page-lead">Ваше ім’я, фото та особисті налаштування ReadHub.</p>
    <nav className="personal-nav" aria-label="Особистий розділ"><Link to="/my-clubs">Мої клуби</Link><Link to="/requests">Мої заявки</Link></nav>
    {loading && <p role="status">Завантаження профілю…</p>}
    {error && <p role="alert" className="form-alert">{error}</p>}
    {notice && <p role="status" className="flash">{notice}</p>}
    {!loading && !profile && <AppButton onClick={reload}>Спробувати ще раз</AppButton>}
    {profile && <div className="profile-card"><div className="profile-registration"><span>У ReadHub з {registered ? new Date(registered).toLocaleDateString('uk-UA') : '—'}</span>
      <AppButton variant="ghost" disabled={busy} onClick={reload}>Оновити профіль</AppButton></div>
      <ProfileForm key={revision} profile={profile} busy={busy} onSave={save} /></div>}
  </div>
}
export default function ProfilePage() { const { user } = useAuth(); return <Profile key={user.id} user={user} /> }
