import { lazy } from 'react'

// Failed module URLs are cached by React.lazy/browser; recover with a full reload.
export function lazyPage(load, name) {
  return lazy(() => load().then(module => ({ default: module[name] })).catch(cause => {
    const error = new Error('Не вдалося завантажити код сторінки.', { cause })
    error.name = 'PageChunkError'
    throw error
  }))
}
