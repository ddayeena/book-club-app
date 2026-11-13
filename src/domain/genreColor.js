// Палітра «корінців»: колір жанру однаковий на полиці, у списку й у тегах.
const palette = [
  { name: 'vermilion', spine: '#d9482b', soft: '#fbe4de', text: '#8c2a14' },
  { name: 'gold', spine: '#e0a62f', soft: '#fbf0d3', text: '#6b4b05' },
  { name: 'teal', spine: '#2a7f7f', soft: '#d8efee', text: '#17504f' },
  { name: 'plum', spine: '#7a3e65', soft: '#f1e0ea', text: '#55264a' },
  { name: 'sky', spine: '#4a7fb5', soft: '#dde9f5', text: '#24496f' },
  { name: 'sage', spine: '#6b8f71', soft: '#e2ede0', text: '#36563c' },
]

const knownGenres = {
  'Художня література': 4,
  'Наукпоп': 2,
  'Детектив': 3,
  'Фентезі': 5,
  'Психологія': 1,
  'Історичний роман': 0,
}

export function genreColor(genre) {
  const text = String(genre ?? '')
  if (Object.hasOwn(knownGenres, text)) return palette[knownGenres[text]]

  let sum = 0
  for (const char of text) sum += char.codePointAt(0)
  return palette[sum % palette.length]
}
