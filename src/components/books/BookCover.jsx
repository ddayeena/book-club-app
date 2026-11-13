import { useState } from 'react'
import { safeCoverUrl } from '../../domain/bookValidation.js'

function Cover({ src, title }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <div className="book-cover book-cover-placeholder" role="img" aria-label="Обкладинки немає"><span aria-hidden="true">RH</span></div>
  return <img className="book-cover" src={src} alt={`Обкладинка: ${title}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
}
export default function BookCover({ url, title }) {
  const src = safeCoverUrl(url)
  return <Cover key={src ?? 'empty'} src={src} title={title} />
}
