import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Block from '../components/ui/Block.jsx'
import CatalogStats from '../components/clubs/CatalogStats.jsx'
import ClubShelf from '../components/clubs/ClubShelf.jsx'
import useAuth from '../hooks/useAuth.js'
import useClubs from '../hooks/useClubs.js'
import useRequests from '../hooks/useRequests.js'
import { clubFormatOptions, optionLabel } from '../domain/options.js'
import { meetingParts } from '../domain/dates.js'
import { formatMeetingTime, localDateTime } from '../domain/meetingValidation.js'
import { firstName } from '../domain/people.js'
import { genreColor } from '../domain/genreColor.js'

const steps = [
  {
    title: 'Оберіть клуб',
    text: 'Фільтруйте каталог за жанром, форматом зустрічей і книгою, яку клуб читає зараз.',
  },
  {
    title: 'Подайте заявку',
    text: 'Розкажіть, чому хочете приєднатися, який у вас досвід і скільки часу готові приділяти.',
  },
  {
    title: 'Читайте разом',
    text: 'Приходьте на зустрічі, обговорюйте прочитане або заснуйте власний клуб.',
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { clubs: allClubs } = useClubs()
  const clubs = allClubs.filter((club) => !club.archivedAt)
  const { requests, status } = useRequests()
  const [query, setQuery] = useState('')

  const readingNow = clubs.filter((club) => club.currentBook)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const upcoming = clubs.filter((club) => typeof club.nextMeetingAt === 'string' && Number.isFinite(Date.parse(club.nextMeetingAt)))
    .sort((a, b) => Date.parse(a.nextMeetingAt) - Date.parse(b.nextMeetingAt) || a.id.localeCompare(b.id))
    .slice(0, 4)
  const popular = [...clubs]
    .sort((a, b) => b.membersCount - a.membersCount)
    .slice(0, 4)
  const recent = [...requests]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3)

  function clubName(id) {
    return allClubs.find((club) => club.id === id)?.name ?? 'Клуб недоступний'
  }

  function handleSearch(event) {
    event.preventDefault()
    const text = query.trim()
    navigate(text ? `/clubs?${new URLSearchParams({ q: text })}` : '/clubs')
  }

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">Платформа для читачів</p>
          <h1>
            Читайте разом.
            <br />
            <em>Говоріть глибше.</em>
          </h1>
          <p className="hero-lead">
            Знаходьте книжкові клуби за інтересами, подавайте заявки на
            приєднання або засновуйте власний клуб за хвилину.
          </p>

          <form className="hero-search" role="search" onSubmit={handleSearch}>
            <label htmlFor="hero-query" className="visually-hidden">Пошук клубу</label>
            <input
              id="hero-query"
              type="search"
              placeholder="Назва клубу, жанр або книга"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" className="app-button app-button-primary">Шукати</button>
          </form>

          <div className="hero-links">
            <Link to="/clubs" className="link-inline">Увесь каталог</Link>
            {user ? (
              <Link to="/clubs/new" className="link-inline">Створити клуб</Link>
            ) : (
              <Link to="/register" className="link-inline">Створити обліковий запис</Link>
            )}
          </div>
        </div>

        <ClubShelf clubs={clubs} />
      </section>

      <CatalogStats clubs={clubs} />

      {user && (
        <section className="welcome" aria-label="Ваш кабінет">
          <p>
            Вітаємо, <strong>{firstName(user.name)}</strong>.
            {status === 'success' && (
              <> У вас {requests.length === 0 ? 'ще немає заявок' : `заявок: ${requests.length}`}.</>
            )}
          </p>
          <div className="welcome-actions">
            <Link to="/clubs/new" className="link-button">Створити клуб</Link>
            <Link to="/requests" className="link-button link-button-secondary">Мої заявки</Link>
          </div>
        </section>
      )}

      <Block number="01" title="Найближчі зустрічі">
        {upcoming.length === 0 ? <p className="muted">Запланованих зустрічей із визначеним часом поки немає.</p>
          : <p className="field-hint">Часовий пояс: {timezone}</p>}
        <ol className="timeline">
          {upcoming.map((club) => {
            const parts = meetingParts(localDateTime(club.nextMeetingAt).slice(0, 10))
            const color = genreColor(club.genre)
            return (
              <li key={club.id}>
                <span className="timeline-date" style={{ borderColor: color.spine }}>
                  <strong>{parts.day}</strong>
                  <span>{parts.month}</span>
                </span>
                <div className="timeline-info">
                  <Link to={`/clubs/${encodeURIComponent(club.id)}`}>{club.name}</Link>
                  <time dateTime={club.nextMeetingAt}>{formatMeetingTime(club.nextMeetingAt, timezone)}</time>
                  <span>
                    {optionLabel(clubFormatOptions, club.format)}
                    {club.currentBook ? `, ${club.currentBook}` : ', книгу ще не обрано'}
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      </Block>

      <Block number="02" title="Зараз читають">
        {readingNow.length === 0 ? (
          <p className="muted">Поки що жоден клуб не обрав книгу.</p>
        ) : (
          <ul className="reading-list">
            {readingNow.map((club) => (
              <li key={club.id}>
                <span
                  className="reading-bar"
                  style={{ backgroundColor: genreColor(club.genre).spine }}
                  aria-hidden="true"
                />
                <div>
                  <p className="reading-title">{club.currentBook}</p>
                  <p className="reading-club">{club.name}</p>
                </div>
                <Link to={`/clubs/${encodeURIComponent(club.id)}`} className="link-inline">
                  Відкрити клуб
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block number="03" title="Як це працює">
        <ol className="steps">
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className="step-number">{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </Block>

      <Block number="04" title="Спільнота">
        <div className="split">
          <div>
            <h3 className="split-title">Популярні клуби</h3>
            <ol className="rank-list">
              {popular.map((club) => (
                <li key={club.id}>
                  <Link to={`/clubs/${encodeURIComponent(club.id)}`}>{club.name}</Link>
                  <span>{club.membersCount} учасників</span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h3 className="split-title">{user ? 'Ваші останні заявки' : 'Приєднуйтесь'}</h3>
            {!user && (
              <div className="invite">
                <p>Увійдіть, щоб подавати заявки, відстежувати їх і створювати власні клуби.</p>
                <div className="page-toolbar">
                  <Link to="/login" className="link-button">Увійти</Link>
                  <Link to="/register" className="link-inline">Реєстрація</Link>
                </div>
              </div>
            )}
            {user && status === 'loading' && <p className="muted" role="status">Завантаження…</p>}
            {user && status === 'error' && (
              <p className="muted">Не вдалося завантажити заявки.</p>
            )}
            {user && status === 'success' && recent.length === 0 && (
              <p className="muted">
                Заявок ще немає. <Link to="/clubs">Оберіть клуб і подайте першу.</Link>
              </p>
            )}
            {user && status === 'success' && recent.length > 0 && (
              <ul className="rank-list">
                {recent.map((request) => (
                  <li key={request.id}>
                    <Link to={`/requests/${encodeURIComponent(request.id)}`}>
                      {clubName(request.clubId)}
                    </Link>
                    <span>{request.weeklyHours} год на тиждень</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Block>
    </>
  )
}
