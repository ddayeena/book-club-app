export default function Block({ number, title, children }) {
  const titleId = `block-${number}-title`

  return (
    <section className="block" aria-labelledby={titleId}>
      <div className="block-label">
        <span className="block-number" aria-hidden="true">{number}</span>
        <h2 id={titleId}>{title}</h2>
      </div>
      <div className="block-body">{children}</div>
    </section>
  )
}
