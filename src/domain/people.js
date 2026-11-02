export function initials(name) {
  const letters = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase('uk'))
  return letters.join('') || '?'
}

export function firstName(name) {
  return String(name ?? '').trim().split(/\s+/)[0] ?? ''
}
