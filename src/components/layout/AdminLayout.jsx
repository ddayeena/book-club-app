import PageLoading from './PageLoading.jsx'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import useAuth from '../../hooks/useAuth.js'
import ErrorBoundary from './ErrorBoundary.jsx'

export default function AdminLayout() {
  const { user, refreshAccess } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [mobile, setMobile] = useState(() => window.matchMedia?.('(max-width: 800px)').matches ?? false)
  const sidebar = useRef(null)
  const toggle = useRef(null)
  const content = useRef(null)
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 800px)')
    const change = (event) => { setMobile(event.matches); setOpen(false) }
    media?.addEventListener('change', change)
    return () => media?.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'hidden') void refreshAccess() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [refreshAccess])
  useEffect(() => {
    if (!mobile || !open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sidebar.current?.querySelector('button')?.focus()
    return () => { document.body.style.overflow = previousOverflow }
  }, [mobile, open])
  useEffect(() => { content.current?.focus() }, [location.pathname])
  function close() { setOpen(false); toggle.current?.focus() }
  function navigateSection() { setOpen(false); requestAnimationFrame(() => content.current?.focus()) }
  function keyboard(event) {
    if (!mobile || !open) return
    if (event.key === 'Escape') { event.preventDefault(); close() }
    if (event.key === 'Tab') {
      const nodes = sidebar.current.querySelectorAll('a[href], button:not([disabled])')
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
  }
  return <div className={`admin-shell${open ? ' admin-sidebar-open' : ''}`}>
    <a className="admin-skip" href="#admin-content">Перейти до вмісту</a>
    <aside id="admin-sidebar" ref={sidebar} className="admin-sidebar" aria-label="Панель навігації"
      role={mobile && open ? 'dialog' : undefined} aria-modal={mobile && open ? true : undefined}
      inert={mobile && !open ? true : undefined} onKeyDown={keyboard}>
      <div className="admin-brand-row"><Link className="admin-brand" to="/admin" onClick={navigateSection}>ReadHub<span>Керування платформою</span></Link>
        <button type="button" className="admin-close" onClick={close} aria-label="Закрити меню">×</button></div>
      <nav className="admin-nav" aria-label="Адміністрування">
        {[['/admin', 'Статистика'], ['/admin/users', 'Користувачі'], ['/admin/clubs', 'Клуби']].map(([to, label]) =>
          <NavLink key={to} to={to} end={to === '/admin'} onClick={navigateSection}>{label}</NavLink>)}
      </nav>
      <div className="admin-sidebar-bottom"><p>{user.name || 'Адміністратор'}<span>Адміністратор</span></p>
        <Link to="/">← Повернутися на сайт</Link></div>
    </aside>
    {mobile && open && <button className="admin-backdrop" type="button" aria-label="Закрити навігацію" tabIndex={-1} onClick={close} />}
    <div className="admin-workspace" inert={mobile && open ? true : undefined}>
      <header className="admin-topbar"><button ref={toggle} className="admin-menu-toggle" type="button" aria-expanded={open}
        aria-controls="admin-sidebar" onClick={() => setOpen(true)}>☰ Меню</button><span>Панель адміністратора</span></header>
      <main id="admin-content" className="admin-content" tabIndex={-1} ref={content}>
        <ErrorBoundary resetKey={location.pathname}><Suspense fallback={<PageLoading />}><Outlet key={user.id} /></Suspense></ErrorBoundary>
      </main>
    </div>
  </div>
}
