import GenreTag from '../ui/GenreTag.jsx'
import { clubFormatOptions, optionLabel } from '../../domain/options.js'
import { genreColor } from '../../domain/genreColor.js'

export default function ClubPreview({ draft }) {
  const name = draft.name.trim() || 'Назва клубу'
  const genre = draft.genre.trim() || 'Жанр'
  const book = draft.currentBook.trim()
  const description = draft.description.trim() || 'Тут зʼявиться опис клубу.'
  const color = genreColor(genre)

  return (
    <aside className="club-preview" aria-label="Попередній перегляд клубу">
      <p className="preview-label">Так клуб побачать інші</p>
      <article className="club-row">
        <span className="club-spine" style={{ backgroundColor: color.spine }} aria-hidden="true" />
        <div className="club-row-main">
          <div className="club-row-tags">
            <GenreTag genre={genre} />
            <span className="meta-tag">{optionLabel(clubFormatOptions, draft.format)}</span>
          </div>
          <h3>{name}</h3>
          <p className="club-row-reading">
            <span className={book ? 'status active' : 'status'}>
              {book ? `Зараз читають: ${book}` : 'Книгу ще не обрано'}
            </span>
          </p>
          <dl className="club-facts">
            <div>
              <dt>Найближча зустріч</dt>
              <dd>Окремий розклад зустрічей</dd>
            </div>
            <div>
              <dt>Зустрічей на місяць</dt>
              <dd>{draft.meetingsPerMonth || '—'}</dd>
            </div>
            <div>
              <dt>Мова</dt>
              <dd>{draft.language}</dd>
            </div>
          </dl>
          <p className="club-row-description">{description}</p>
        </div>
      </article>
    </aside>
  )
}
