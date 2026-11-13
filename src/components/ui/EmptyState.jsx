export default function EmptyState({ title, children }) {
  return (
    <div className="empty-state">
      <p><strong>{title}</strong></p>
      {children}
    </div>
  )
}
