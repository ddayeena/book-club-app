export function requestStatusLabel(status) {
  return { pending: 'Очікує рішення', approved: 'Схвалено', rejected: 'Відхилено', cancelled: 'Скасовано' }[status] ?? 'Невідомий статус'
}
