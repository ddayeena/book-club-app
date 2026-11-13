import { useEffect, useState } from 'react'
import { initials } from '../../domain/people.js'
import { ownsAvatar } from '../../domain/profileValidation.js'
import { profileService } from '../../services/profileService.js'

function AvatarImage({ user }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    let timer
    const renew = () => setAttempt((n) => n + 1)
    profileService.signedAvatar(user.avatarPath, user.id).then((value) => {
      if (!active) return
      setUrl(value); setFailed(false); timer = setTimeout(renew, 105000)
    }).catch(() => { if (active) { setUrl(null); timer = setTimeout(renew, 30000) } })
    const visible = () => { if (document.visibilityState !== 'hidden') renew() }
    window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible)
    return () => { active = false; clearTimeout(timer); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible) }
  }, [user.id, user.avatarPath, attempt])
  return url && !failed ? <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <span aria-hidden="true">{initials(user.name)}</span>
}
export default function UserAvatar({ user, large = false }) {
  return <span className={`user-avatar${large ? ' user-avatar-large' : ''}`} role="img" aria-label={`Аватар: ${user.name}`}>
    {ownsAvatar(user.avatarPath, user.id) ? <AvatarImage key={user.id + user.avatarPath} user={user} /> : <span aria-hidden="true">{initials(user.name)}</span>}
  </span>
}
