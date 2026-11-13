import { useEffect, useState } from 'react'
import { discussionService } from '../services/discussionService.js'
import { bookService } from '../services/bookService.js'
import { errorMessage } from '../services/ServiceError.js'
import useAuth from './useAuth.js'

export default function useDiscussionResource(kind, clubId, topicId = null, page = 1, bookId = null) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [revision, setRevision] = useState(0), [result, setResult] = useState(null)
  const [bookResult, setBookResult] = useState(null)
  const bookKey = JSON.stringify([clubId, userId, revision])
  const key = JSON.stringify([kind, clubId, topicId, page, bookId, revision, userId])
  useEffect(() => {
    if (kind !== 'list') return
    const controller = new AbortController()
    bookService.getAll(clubId, { signal: controller.signal }).then(
      books => { if (!controller.signal.aborted) setBookResult({ key: bookKey, books }) },
      cause => { if (!controller.signal.aborted) setBookResult({ key: bookKey, error: errorMessage(cause) }) },
    )
    return () => controller.abort()
  }, [kind, clubId, bookKey])
  useEffect(() => {
    const controller = new AbortController(), options = { signal: controller.signal }
    async function load() {
      if (kind === 'list') {
        return { list: await discussionService.list(clubId, { ...options, page, bookId }) }
      }
      const topic = topicId ? await discussionService.get(topicId, options) : null
      if (controller.signal.aborted) return null
      if (topic && topic.club_id !== clubId) throw new Error('Topic belongs to another club')
      if (kind === 'editor') return { topic, books: topic?.deleted_at ? [] : await bookService.getAll(clubId, options) }
      return { topic, comments: topic.deleted_at ? null : await discussionService.comments(topicId, { ...options, page }) }
    }
    load().then((data) => { if (!controller.signal.aborted) setResult({ key, data }) },
      (cause) => { if (!controller.signal.aborted) setResult({ key, error: errorMessage(cause) }) })
    return () => controller.abort()
  }, [kind, clubId, topicId, page, bookId, key])
  const current = result?.key === key ? result : null
  const books = bookResult?.key === bookKey ? bookResult : null
  const data = kind === 'list' ? current?.data && books?.books && { ...current.data, books: books.books } : current?.data
  return { data, error: current?.error || (kind === 'list' ? books?.error : undefined), reload: () => setRevision((n) => n + 1) }
}
