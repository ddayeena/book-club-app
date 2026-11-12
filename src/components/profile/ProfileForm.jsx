import { useEffect, useRef, useState } from 'react'
import AppButton from '../ui/AppButton.jsx'
import FormField from '../ui/FormField.jsx'
import UserAvatar from './UserAvatar.jsx'
import { validateAvatar, validateProfile } from '../../domain/profileValidation.js'

export default function ProfileForm({ profile, busy, onSave }) {
  const [draft, setDraft] = useState({ name: profile.name, remindersEnabled: profile.remindersEnabled })
  const [file, setFile] = useState(null)
  const [remove, setRemove] = useState(false)
  const [fileError, setFileError] = useState('')
  const [checking, setChecking] = useState(false)
  const [preview, setPreview] = useState(null)
  const [attempted, setAttempted] = useState(false)
  const version = useRef(0)
  const input = useRef(null)
  const validation = validateProfile(draft)
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    let active = true
    Promise.resolve().then(() => { if (active) setPreview(url) })
    return () => { active = false; URL.revokeObjectURL(url) }
  }, [file])
  useEffect(() => () => { version.current += 1 }, [])
  async function choose(event) {
    const candidate = event.target.files?.[0]
    if (!candidate) return
    const ticket = ++version.current
    setChecking(true); setFileError('')
    try {
      const error = await validateAvatar(candidate)
      if (ticket !== version.current) return
      if (error) { setFileError(error); event.target.value = ''; return }
      setPreview(null); setFile(candidate); setRemove(false)
    } catch { if (ticket === version.current) setFileError('Не вдалося прочитати файл.') }
    finally { if (ticket === version.current) setChecking(false) }
  }
  function resetPhoto() { setFile(null); setPreview(null); setRemove(false); setFileError(''); if (input.current) input.current.value = '' }
  return <form className="profile-form" aria-label="Редагування профілю" noValidate onSubmit={(event) => {
    event.preventDefault(); setAttempted(true)
    if (!busy && !checking && !fileError && validation.ok) void onSave(draft, { avatarFile: file, removeAvatar: remove })
  }}>
    <fieldset className="fieldset-plain" disabled={busy || checking}><legend className="visually-hidden">Налаштування профілю</legend>
      <section className="profile-photo" aria-label="Фото профілю"><div>
        {file && preview ? <img className="profile-preview" src={preview} alt="Попередній перегляд нового фото" /> : <UserAvatar user={{ ...profile, avatarPath: remove ? null : profile.avatarPath }} large />}
      </div><div><h2>Ваше фото</h2><p className="field-hint">JPEG, PNG або WebP, до 1 MB. Фото зберігається приватно.</p>
        <label className="profile-file-label" htmlFor="profile-avatar">Обрати фото</label>
        <input ref={input} id="profile-avatar" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void choose(e)} aria-describedby="profile-avatar-hint" />
        <p id="profile-avatar-hint" className="field-hint">Зміна фото застосовується після збереження профілю.</p>
        {fileError && <p role="alert" className="field-error">{fileError}</p>}
        <div className="form-actions">{profile.avatarPath && !remove && <AppButton variant="secondary" onClick={() => { resetPhoto(); setRemove(true) }}>Видалити фото</AppButton>}
          {(file || remove) && <AppButton variant="ghost" onClick={resetPhoto}>Скасувати зміну фото</AppButton>}</div>
        {remove && <p role="status">Фото буде видалено після збереження.</p>}</div></section>
      <FormField id="profile-name" label="Ім’я" error={attempted ? validation.errors.name : ''}>
        <input id="profile-name" value={draft.name} maxLength={40} autoComplete="name" required aria-invalid={attempted && Boolean(validation.errors.name)}
          aria-describedby={attempted && validation.errors.name ? 'profile-name-error' : undefined} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
      </FormField>
      <section className="profile-reminders"><h2>Нагадування</h2>
        <label className="checkbox-field"><input type="checkbox" checked={draft.remindersEnabled} onChange={(e) => setDraft((d) => ({ ...d, remindersEnabled: e.target.checked }))} />Хочу отримувати нагадування</label>
        <p className="field-hint">Зараз зберігається лише ваше налаштування. Автоматичне надсилання ще не ввімкнено.</p></section>
      <div className="form-actions"><AppButton type="submit">{busy ? 'Збереження…' : 'Зберегти профіль'}</AppButton></div>
    </fieldset>
    {checking && <p role="status">Перевірка зображення…</p>}
  </form>
}
