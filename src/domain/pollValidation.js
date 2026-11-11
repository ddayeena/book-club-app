export const pollStatuses = { open: 'Триває', closed: 'Очікує результату', finalized: 'Результат зафіксовано', cancelled: 'Скасовано' }

export function validatePoll(draft, now = Date.now()) {
  const title = String(draft.title ?? '').trim()
  const ends = new Date(draft.endsAt).getTime()
  const bookIds = Array.isArray(draft.bookIds) ? draft.bookIds : []
  const errors = {}
  if (title.length < 3 || title.length > 120) errors.title = 'Назва: від 3 до 120 символів.'
  if (!Number.isFinite(ends) || ends <= now) errors.endsAt = 'Оберіть майбутню дату завершення.'
  if (bookIds.length < 2 || new Set(bookIds).size !== bookIds.length) errors.bookIds = 'Оберіть щонайменше дві різні заплановані книги.'
  return { ok: !Object.keys(errors).length, errors,
    value: { title, endsAt: Number.isFinite(ends) ? new Date(ends).toISOString() : null, bookIds } }
}
export function pollLeaders(options) {
  const best = Math.max(0, ...options.map((o) => o.votes))
  return options.filter((o) => o.votes === best)
}
export function votePercent(votes, total) { return total ? Math.round(votes / total * 1000) / 10 : 0 }
