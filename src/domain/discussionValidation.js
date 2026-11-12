export function validateDiscussion(input, comment = false) {
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const body = typeof input.body === 'string' ? input.body.trim() : ''
  const errors = {}, length = (text) => Array.from(text).length
  if (!comment && (length(title) < 3 || length(title) > 120)) errors.title = 'Назва має містити від 3 до 120 символів.'
  if (!length(body) || length(body) > (comment ? 2000 : 10000)) errors.body = `Текст має містити від 1 до ${comment ? 2000 : 10000} символів.`
  return { ok: !Object.keys(errors).length, errors, value: { title, body, bookId: input.bookId || null } }
}
