import HomePage from './pages/HomePage.jsx'

export default function App() {
  return (
    <>
      <header className="site-header">
        <span>Книжкові клуби</span>
        <nav aria-label="Основна навігація">
          <a href="#about">Про застосунок</a>
          <a href="#catalog">Клуби</a>
        </nav>
      </header>
      <main>
        <HomePage />
      </main>
      <footer>Навчальний проєкт. Початковий каталог клубів.</footer>
    </>
  )
}