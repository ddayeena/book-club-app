import { useCallback, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import useAuth from '../../hooks/useAuth.js'
import useAdminResource from '../../hooks/useAdminResource.js'
import { adminService } from '../../services/adminService.js'
import PageHeading from '../ui/PageHeading.jsx'
import AppButton from '../ui/AppButton.jsx'
import AdminFeedback from './AdminFeedback.jsx'
import AdminConfirmation from './AdminConfirmation.jsx'

function Collection({ kind, query, update }) {
  const users = kind === 'users'
  const location = useLocation()
  const { user } = useAuth()
  const load = useCallback((signal) => adminService[kind](query, { signal }), [kind, query])
  const resource = useAdminResource(load)
  const [search, setSearch] = useState(query.search)
  const [target, setTarget] = useState(null)
  const opener = useRef(null)
  const items = resource.data?.items ?? []
  const total = Number(resource.data?.total ?? 0)
  const pages = Math.max(1, Math.ceil(total / 20))
  function close() {
    setTarget(null)
    requestAnimationFrame(() => opener.current?.focus())
  }
  async function confirm() {
    const ok = await resource.run(() => users ? adminService.setBlocked(target.id, !target.is_blocked) : adminService.archive(target.id),
      users ? target.is_blocked ? 'Користувача розблоковано.' : 'Користувача заблоковано.' : 'Клуб архівовано.')
    if (ok) close()
  }
  return <>
    <PageHeading title={users ? 'Керування користувачами' : 'Керування клубами'} />
    <p className="page-lead">{users ? 'Профілі та стан доступу до платформи.' : 'Активні клуби та збережена історія спільноти.'}</p>
    <form className="admin-filters" aria-label="Пошук і фільтри" onSubmit={(e) => { e.preventDefault(); if (!resource.busy) update('q', search.trim()) }}>
      <fieldset disabled={resource.busy} className="fieldset-plain">
        <div className="admin-filter-fields"><label>Пошук<input type="search" maxLength={120} value={search} placeholder={users ? 'Ім’я або ID' : 'Клуб або власник'} onChange={(e) => setSearch(e.target.value)} /></label>
          {users && <label>Роль<select value={query.role} onChange={(e) => update('role', e.target.value)}>
            <option value="all">Усі ролі</option><option value="user">Користувачі</option><option value="admin">Адміністратори</option></select></label>}
          <label>Стан<select value={query.state} onChange={(e) => update('state', e.target.value)}>
            <option value="all">Усі стани</option><option value="active">Активні</option>
            <option value={users ? 'blocked' : 'archived'}>{users ? 'Заблоковані' : 'Архівні'}</option></select></label>
          <AppButton type="submit">Знайти</AppButton>
          <AppButton variant="secondary" onClick={() => update('reset')}>Скинути</AppButton></div>
      </fieldset>
    </form>
    <AdminFeedback resource={resource} />
    {target && <AdminConfirmation title={users ? target.is_blocked ? 'Розблокувати користувача?' : 'Заблокувати користувача?' : 'Архівувати клуб?'} busy={resource.busy} onCancel={close} onConfirm={() => void confirm()}>
      <p><strong>{target.name}</strong></p><p>{users ? 'Дані, клуби та історія користувача зберігаються.' : 'Клуб залишиться в історії. Очікувані заявки буде відхилено, незавершене голосування — скасовано.'}</p>
    </AdminConfirmation>}
    {resource.data && !resource.loading && <>
      <p role="status">Знайдено: {total}</p>
      {!items.length && <p className="state-banner">За цими умовами нічого не знайдено. Змініть фільтри або поверніться на попередню сторінку.</p>}
      {items.length > 0 && <div className="admin-table-scroll" role="region" aria-label={users ? 'Таблиця користувачів' : 'Таблиця клубів'} tabIndex={0}>
        <table className="admin-table"><caption className="visually-hidden">{users ? 'Користувачі платформи' : 'Клуби платформи'}</caption>
          <thead><tr><th scope="col">{users ? 'Користувач' : 'Назва клубу'}</th><th scope="col">{users ? 'Роль' : 'Власник'}</th>
            {!users && <th scope="col">Учасники</th>}<th scope="col">Статус</th><th scope="col">Створено</th><th scope="col">Дії</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}>
            <th scope="row"><span className="admin-record-name"><Link to={`/admin/${kind}/${item.id}${location.search}`}>{item.name}</Link></span>{users && item.id === user.id && <span className="admin-self">Це ви</span>}
              <span className="admin-id">{item.id}</span></th>
            <td>{users ? item.role === 'admin' ? 'Адміністратор' : 'Користувач' : item.owner_name}</td>
            {!users && <td>{item.members_count}</td>}
            <td><span className={`admin-status ${users ? item.is_blocked ? 'admin-status-blocked' : '' : item.archived_at ? 'admin-status-archived' : ''}`}>
              {users ? item.is_blocked ? 'Заблоковано' : 'Активний' : item.archived_at ? 'Архівний' : 'Активний'}</span></td>
            <td className="admin-date">{new Date(item.created_at).toLocaleDateString('uk-UA')}</td>
            <td><div className="admin-row-actions">
              <AppButton variant="secondary" disabled={resource.busy || (users ? item.id === user.id : Boolean(item.archived_at))}
                onClick={(e) => { opener.current = e.currentTarget; setTarget(item) }}>{users ? item.is_blocked ? 'Розблокувати' : 'Заблокувати' : 'Архівувати'}</AppButton>
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <nav className="admin-pagination" aria-label="Пагінація">
        <AppButton variant="secondary" disabled={resource.busy || query.page <= 1} onClick={() => update('page', String(query.page - 1))}>Попередня</AppButton>
        <span>Сторінка {query.page} · Усього сторінок: {pages}</span>
        <AppButton variant="secondary" disabled={resource.busy || query.page >= pages} onClick={() => update('page', String(query.page + 1))}>Наступна</AppButton>
      </nav>
    </>}
  </>
}
export default function AdminList({ kind }) {
  const [params, setParams] = useSearchParams()
  const states = kind === 'users' ? ['all', 'active', 'blocked'] : ['all', 'active', 'archived']
  const rawPage = Number(params.get('page') ?? 1)
  const query = { search: (params.get('q') ?? '').slice(0, 120),
    state: states.includes(params.get('state')) ? params.get('state') : 'all',
    role: ['user', 'admin'].includes(params.get('role')) ? params.get('role') : 'all',
    page: Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 1000000 ? rawPage : 1 }
  function update(key, value) {
    const next = new URLSearchParams(params)
    if (key === 'reset') { setParams({}); return }
    if (!value || value === 'all' || (key === 'page' && value === '1')) next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }
  // URL changes remount the collection, cancelling reads and clearing stale action targets.
  return <Collection key={kind + params.toString()} kind={kind} query={query} update={update} />
}
