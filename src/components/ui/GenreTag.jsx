import { genreColor } from '../../domain/genreColor.js'

export default function GenreTag({ genre }) {
  const color = genreColor(genre)

  return (
    <span className="genre-tag" style={{ backgroundColor: color.soft, color: color.text }}>
      <span className="genre-dot" style={{ backgroundColor: color.spine }} aria-hidden="true" />
      {genre}
    </span>
  )
}
