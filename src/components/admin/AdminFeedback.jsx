import AppButton from '../ui/AppButton.jsx'

export default function AdminFeedback({ resource }) {
  return <>
    {resource.notice && <p role="status" className="flash">{resource.notice}</p>}
    {resource.error && <p role="alert" className="form-alert">{resource.error}</p>}
    {resource.loading && <p role="status">Завантаження даних…</p>}
    <div className="page-toolbar"><AppButton variant="secondary" disabled={resource.busy || resource.loading} onClick={resource.refresh}>
      {resource.error ? 'Спробувати ще раз' : 'Оновити дані'}</AppButton></div>
  </>
}
