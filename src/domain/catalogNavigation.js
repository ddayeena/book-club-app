const filterKeys = ['q', 'genre', 'format', 'reading', 'mine', 'sort', 'language', 'members', 'meeting']
function catalogFromSearch(search) {
  const input = new URLSearchParams(search), output = new URLSearchParams()
  if (input.has('returnTo')) return null // Never nest a return URL in another one.
  for (const key of filterKeys) {
    const value = input.get(key)
    if (value) output.set(key, value)
  }
  return output.size ? `/clubs?${output}` : null
}
export function safeCatalogReturn(value) {
  if (typeof value !== 'string' || value.length > 8192 || /[\\#]/.test(value)
    || Array.from(value).some((character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127)) return null
  if (!value.startsWith('/clubs?')) return null
  return catalogFromSearch(value.slice('/clubs'.length))
}
function clubId(pathname) {
  const id = /^\/clubs\/([^/]+)(?:\/|$)/.exec(pathname)?.[1]
  return id && id !== 'new' ? id : null
}
export function clubNavigationTarget(to, location) {
  if (typeof to !== 'string' && (!to || typeof to !== 'object')) return to
  const match = typeof to === 'string' ? /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(to) : null
  const pathname = match ? match[1] : to.pathname
  const search = match ? match[2] ?? '' : to.search ?? ''
  const hash = match ? match[3] ?? '' : to.hash ?? ''
  const sourceId = clubId(location.pathname), destinationId = clubId(pathname ?? '')
  const sourceParams = new URLSearchParams(location.search)
  const fromCatalog = /^\/clubs\/?$/.test(location.pathname)
  const context = fromCatalog ? catalogFromSearch(location.search)
    : sourceId && sourceParams.getAll('returnTo').length === 1 ? safeCatalogReturn(sourceParams.get('returnTo')) : null
  if (pathname === '/clubs' && !search && sourceId && context) return typeof to === 'string' ? context + hash : { ...to, search: context.slice('/clubs'.length) }
  if (!destinationId || (!fromCatalog && sourceId !== destinationId)) return to
  const params = new URLSearchParams(search)
  if (!context && !params.has('returnTo')) return to
  params.delete('returnTo')
  if (context) params.set('returnTo', context)
  const query = params.size ? `?${params}` : ''
  return typeof to === 'string' ? pathname + query + hash : { ...to, search: query }
}
