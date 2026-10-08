import { Link } from 'react-router'
import { clubs } from '../data/clubs.js'
import useRequests from '../hooks/useRequests.js'
import CatalogStats from '../components/clubs/CatalogStats.jsx'

const steps = [
  {
    title: 'Оберіть клуб',
    text: 'Перегляньте каталог і знайдіть клуб за назвою або за тим, що він читає зараз.',
  },
  {
    title: 'Подайте заявку',
    text: 'Розкажіть, чому хочете приєднатися, і скільки годин на тиждень готові приділяти.',
  },
  {
    title: 'Читайте разом',
    text: 'Отримуйте нагадування про зустрічі та обговорюйте прочитане з однодумцями.',
  },
]

export default function HomePage() {
  const { requests, status } = useRequests()
  const readingNow = clubs.filter((club) => club.currentBook)
  const popular = [...clubs]
    .sort((a, b) => b.membersCount - a.membersCount)
    .slice(0, 3)
  const recent = [...requests].reverse().slice(0, 3)

  function clubName(id) {
    return clubs.find((club) => club.id === id)?.name ?? 'Клуб відсутній'
  }

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <p className="hero-kicker">Платформа для книголюбів</p>
          <h1>Читайте разом, обговорюйте глибше</h1>
          <p>
            Знаходьте книжкові клуби за інтересами, подавайте заявки на
            приєднання й плануйте спільне читання в одному місці.
          </p>
          <div className="hero-actions">
            <Link to="/clubs" className="link-button">Перейти до каталогу</Link>
            <Link to="/requests" className="link-button link-button-secondary">
              Заявки
            </Link>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="book book-1" />
          <span className="book book-2" />
          <span className="book book-3" />
          <span className="book book-4" />
        </div>
      </section>

      <CatalogStats clubs={clubs} />

      <section className="block">
        <h2>Зараз читають</h2>
        {readingNow.length === 0 ? (
          <p className="muted">Поки що жоден клуб не обрав книгу.</p>
        ) : (
          <ul className="reading-list">
            {readingNow.map((club) => (
              <li key={club.id} className="reading-item">
                <span className="reading-icon" aria-hidden="true">📖</span>
                <div className="reading-info">
                  <strong>{club.currentBook}</strong>
                  <span>Клуб: {club.name}</span>
                </div>
                <Link
                  to={`/clubs/${encodeURIComponent(club.id)}`}
                  className="link-inline"
                >
                  Відкрити клуб
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block">
        <h2>Як це працює</h2>
        <ol className="steps">
          {steps.map((step, index) => (
            <li key={step.title} className="step-card">
              <span className="step-number">{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="split">
        <section className="block panel">
          <h2>Популярні клуби</h2>
          <ol className="rank-list">
            {popular.map((club) => (
              <li key={club.id}>
                <Link to={`/clubs/${encodeURIComponent(club.id)}`}>{club.name}</Link>
                <span className="rank-count">{club.membersCount} учасників</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="block panel">
          <h2>Останні заявки</h2>
          {status === 'loading' && <p className="muted">Завантаження…</p>}
          {status === 'error' && (
            <p className="muted">Не вдалося завантажити заявки.</p>
          )}
          {status === 'success' && recent.length === 0 && (
            <p className="muted">
              Заявок ще немає.{' '}
              <Link to="/clubs">Оберіть клуб і подайте першу</Link>
            </p>
          )}
          {status === 'success' && recent.length > 0 && (
            <ul className="recent-list">
              {recent.map((request) => (
                <li key={request.id}>
                  <Link to={`/requests/${encodeURIComponent(request.id)}`}>
                    {clubName(request.clubId)}
                  </Link>
                  <span className="rank-count">
                    {request.weeklyHours} год/тиждень
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="cta">
        <div>
          <h2>Готові приєднатися?</h2>
          <p>Оберіть клуб у каталозі й подайте заявку за пів хвилини.</p>
        </div>
        <Link to="/clubs" className="link-button">Знайти свій клуб</Link>
      </section>
    </>
  )
}