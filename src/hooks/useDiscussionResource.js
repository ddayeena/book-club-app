import { useEffect, useState } from 'react'
import { discussionService } from '../services/discussionService.js'
import { bookService } from '../services/bookService.js'
import { errorMessage } from '../services/ServiceError.js'

export default function useDiscussionResource(kind, clubId, topicId = null, page = 1, bookId = null) {
  const [revision, setRevision] = useState(0), [result, setResult] = useState(null)
  const key = JSON.stringify([kind, clubId, topicId, page, bookId, revision])
  useEffect(() => {
    const controller = new AbortController(), options = { signal: controller.signal }
    async function load() {
      if (kind === 'list') {
        const [list, books] = await Promise.all([discussionService.list(clubId, { ...options, page, bookId }), bookService.getAll(clubId, options)])
        return { list, books }
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
  return { data: current?.data, error: current?.error, reload: () => setRevision((n) => n + 1) }
}
