import { getSupabase } from './supabaseClient.js'
import { unwrap } from './clubService.js'
import { ServiceError } from './ServiceError.js'

function countValue(value) {
  const count = Number(value)
  if ((typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) || !Number.isSafeInteger(count) || count < 0) throw new ServiceError('Не вдалося прочитати кількість сповіщень.')
  return count
}

async function rpc(name, args, signal) {
  let query = getSupabase().rpc(name, args)
  if (signal) query = query.abortSignal(signal)
  return unwrap(query)
}
export function mapNotification(n) {
  // Only typed internal paths are navigable; never render a server body as HTML.
  const target = typeof n.target === 'string' && /^\/(?:requests\/[^/?#]+|clubs\/[^/?#]+\/(?:requests|meetings\/[^/?#]+))$/.test(n.target) ? n.target : null
  return { id: n.id, type: n.type, body: n.body, createdAt: n.created_at, readAt: n.read_at, isStale: Boolean(n.is_stale), target }
}
export const notificationService = {
  async list({ filter = 'all', page = 1, signal } = {}) {
    const data = await rpc('list_my_notifications', { p_filter: filter, p_page: page, p_size: 20 }, signal)
    return { items: data.items.map(mapNotification), total: countValue(data.total), unreadCount: countValue(data.unread_count) }
  },
  async count({ signal } = {}) { return countValue(await rpc('get_my_unread_notification_count', {}, signal)) },
  async markRead(id) {
    const data = await rpc('mark_notification_read', { p_id: id })
    return { id: data.id, readAt: data.read_at, unreadCount: countValue(data.unread_count) }
  },
}
