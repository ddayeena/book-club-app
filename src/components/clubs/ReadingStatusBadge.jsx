export default function ReadingStatusBadge({ currentBook }) {
    const label = currentBook
      ? `Зараз читають: ${currentBook}`
      : 'Книгу ще не обрано'
    const className = currentBook ? 'status active' : 'status'
  
    return <span className={className}>{label}</span>
  }