import { useEffect } from 'react'

export default function PageHeading({ title }) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = `${title} | Книжкові клуби`

    return () => {
      document.title = previousTitle
    }
  }, [title])

  return <h1>{title}</h1>
}