import { getSupabase } from './supabaseClient.js'
import { currentUserId } from './authService.js'
import { unwrap } from './clubService.js'
import { ServiceError } from './ServiceError.js'
import { avatarTypes, ownsAvatar, validateAvatar, validateProfile } from '../domain/profileValidation.js'

const fields = 'id,name,avatar_path,reminders_enabled,created_at'
const mapProfile = (p) => ({ id: p.id, name: p.name, avatarPath: p.avatar_path, remindersEnabled: p.reminders_enabled, createdAt: p.created_at })
function actor() { const id = currentUserId(); if (!id) throw new ServiceError('Увійдіть до облікового запису.', { code: 'AUTH' }); return id }
function sameActor(id) { if (currentUserId() !== id) throw new ServiceError('Обліковий запис змінився. Оновіть сторінку.', { code: 'SESSION_CHANGED' }) }
function storageResult(result) { if (result.error) throw new ServiceError('Не вдалося виконати операцію з фото. Перевірте з’єднання та сховище.', { code: result.error.code ?? 'STORAGE' }); return result.data }
async function cleanup(id, path) {
  if (!ownsAvatar(path, id) || currentUserId() !== id) return false
  try { const rows = storageResult(await getSupabase().storage.from('avatars').remove([path])); return Boolean(rows?.length) }
  catch { return false }
}
export const profileService = {
  async get({ signal } = {}) {
    const id = actor()
    let query = getSupabase().from('profiles').select(fields).eq('id', id).single()
    if (signal) query = query.abortSignal(signal)
    const row = await unwrap(query); sameActor(id)
    return mapProfile(row)
  },
  async save(draft, { avatarFile = null, removeAvatar = false, previousAvatar = null } = {}) {
    const id = actor()
    const validation = validateProfile(draft)
    if (!validation.ok) throw new ServiceError('Перевірте поля профілю.', { code: 'VALIDATION', errors: validation.errors })
    if (avatarFile && removeAvatar) throw new ServiceError('Оберіть одну дію для фото.', { code: 'VALIDATION' })
    const input = { name: validation.value.name, reminders_enabled: validation.value.remindersEnabled }
    let uploaded = null
    const changedPhoto = Boolean(avatarFile || removeAvatar)
    if (avatarFile) {
      const error = await validateAvatar(avatarFile)
      if (error) throw new ServiceError(error, { code: 'VALIDATION' })
      sameActor(id)
      uploaded = `${id}/${crypto.randomUUID()}.${avatarTypes[avatarFile.type]}`
      try { storageResult(await getSupabase().storage.from('avatars').upload(uploaded, avatarFile, { contentType: avatarFile.type, upsert: false })) }
      catch (cause) { await cleanup(id, uploaded); throw cause }
      input.avatar_path = uploaded
    } else if (removeAvatar) input.avatar_path = null
    let saved
    try {
      sameActor(id)
      let query = getSupabase().from('profiles').update(input).eq('id', id)
      if (changedPhoto) query = previousAvatar == null ? query.is('avatar_path', null) : query.eq('avatar_path', previousAvatar)
      saved = await unwrap(query.select(fields).single())
      if (!saved) throw new ServiceError('Профіль не оновлено. Перечитайте дані.', { code: 'CONFLICT' })
    } catch (cause) {
      if (uploaded) await cleanup(id, uploaded)
      if (changedPhoto && cause.code === 'PGRST116') throw new ServiceError('Фото вже змінилося в іншій вкладці. Оновіть профіль перед повторною спробою.', { code: 'CONFLICT' })
      throw cause
    }
    sameActor(id)
    const warning = changedPhoto && previousAvatar && ownsAvatar(previousAvatar, id) && !(await cleanup(id, previousAvatar))
      ? 'Профіль збережено. Старий файл не вдалося прибрати; чинне фото не втрачено.' : ''
    return { profile: mapProfile(saved), warning }
  },
  async signedAvatar(path, id) {
    if (!ownsAvatar(path, id)) throw new ServiceError('Фото недоступне.', { code: 'AVATAR_PATH' })
    sameActor(id)
    const data = storageResult(await getSupabase().storage.from('avatars').createSignedUrl(path, 120))
    sameActor(id)
    return data.signedUrl
  },
}
