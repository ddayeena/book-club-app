export const experienceOptions = [
  { value: 'beginner', label: 'Новачок' },
  { value: 'regular', label: 'Читаю регулярно' },
  { value: 'advanced', label: 'Досвідчений читач' },
]

export const participationOptions = [
  { value: 'any', label: 'Не має значення' },
  { value: 'online', label: 'Онлайн' },
  { value: 'offline', label: 'Офлайн' },
]

export const clubFormatOptions = [
  { value: 'online', label: 'Онлайн' },
  { value: 'offline', label: 'Офлайн' },
  { value: 'hybrid', label: 'Гібрид' },
]

export function optionLabel(options, value, fallback = '—') {
  return options.find((option) => option.value === value)?.label ?? fallback
}

export function isOption(options, value) {
  return options.some((option) => option.value === value)
}

export const languageOptions = [
  { value: 'Українська', label: 'Українська' },
  { value: 'Англійська', label: 'Англійська' },
  { value: 'Українська та англійська', label: 'Українська та англійська' },
]
