export const avatarMaxBytes = 1048576
export const avatarTypes = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export function validateProfile(draft) {
  const name = String(draft.name ?? '').trim()
  const errors = {}
  if (Array.from(name).length < 2 || Array.from(name).length > 40) errors.name = 'Ім’я має містити від 2 до 40 символів.'
  if (typeof draft.remindersEnabled !== 'boolean') errors.remindersEnabled = 'Оберіть налаштування нагадувань.'
  return { ok: !Object.keys(errors).length, errors, value: { name, remindersEnabled: draft.remindersEnabled } }
}
export function ownsAvatar(path, id) {
  if (!path || !id || path.split('/')[0] !== id) return false
  return /^[^/]+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(path)
}
export async function validateAvatar(file) {
  if (!file || !Object.hasOwn(avatarTypes, file.type)) return 'Оберіть зображення JPEG, PNG або WebP.'
  if (!file.size || file.size > avatarMaxBytes) return 'Розмір фото має бути від 1 байта до 1 MB.'
  const sample = file.slice(0, 12)
  const buffer = sample.arrayBuffer ? await sample.arrayBuffer() : await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsArrayBuffer(sample)
  })
  const bytes = new Uint8Array(buffer)
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  return ({ 'image/png': png, 'image/jpeg': jpeg, 'image/webp': webp })[file.type] ? '' : 'Вміст файла не відповідає формату зображення.'
}
