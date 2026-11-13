export const bookStatuses = { planned: 'Заплановано', current: 'Зараз читаємо', completed: 'Прочитано' }

export function safeCoverUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value.trim())) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.href.length > 2048) return null
    return url.href
  } catch { return null }
}
export function validateBook(input, allowMissingAuthor = false) {
  const text = (value) => typeof value === 'string' ? value.trim() : ''
  const title = text(input.title)
  const author = text(input.author)
  const description = text(input.description)
  const rawCover = text(input.coverUrl)
  const coverUrl = rawCover ? safeCoverUrl(rawCover) : null
  const errors = {}
  if (title.length < 1 || title.length > 200) errors.title = 'Назва має містити від 1 до 200 символів.'
  if ((!allowMissingAuthor && !author) || author.length > 120) errors.author = 'Вкажіть автора (до 120 символів).'
  if (description.length > 2000) errors.description = 'Опис — до 2000 символів.'
  if (rawCover && !coverUrl) errors.coverUrl = 'Вкажіть HTTPS URL без логіна та пароля або залиште поле порожнім.'
  return { ok: Object.keys(errors).length === 0, errors, value: { title, author: author || null, description: description || null, coverUrl } }
}
