import AppButton from '../ui/AppButton.jsx'
export default function DiscussionPagination({ page, total, busy = false, onChange }) {
  return <nav className="page-toolbar" aria-label="Сторінки"><AppButton variant="secondary" disabled={busy || page === 1} onClick={() => onChange(page - 1)}>Попередня</AppButton><span>Сторінка {page} · Усього: {total}</span><AppButton variant="secondary" disabled={busy || page * 20 >= total} onClick={() => onChange(page + 1)}>Наступна</AppButton></nav>
}
