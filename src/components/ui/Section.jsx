export default function Section({ id, title, children }) {
    const titleId = `${id}-title`
  
    return (
      <section id={id} aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        {children}
      </section>
    )
  }