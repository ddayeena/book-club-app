import SiteHeader from './SiteHeader.jsx'

export default function AppLayout({ title, links, children }) {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Перейти до вмісту
      </a>
      <SiteHeader title={title} links={links} />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer>Навчальний проєкт. Каталог клубів і підготовка заявки на приєднання.</footer>
    </>
  )
}