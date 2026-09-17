import ClubCard from '../components/ClubCard.jsx'
import { clubs } from '../data/clubs.js'

export default function HomePage() {
  return (
    <>
      <section id="about" aria-labelledby="about-title">
        <h1 id="about-title">Книжкові клуби</h1>
        <p>Платформа для організації спільного читання й обговорень.</p>
      </section>

      <section id="catalog" aria-labelledby="catalog-title">
        <h2 id="catalog-title">Клуби</h2>
        <p>Клубів у каталозі: {clubs.length}</p>
        {clubs.length === 0 ? (
          <p>Клубів ще не додано.</p>
        ) : (
          <ul className="club-grid">
            {clubs.map((club) => (
              <li key={club.id}>
                <ClubCard club={club} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}