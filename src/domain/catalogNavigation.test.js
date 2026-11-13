import { expect, test } from 'vitest'
import { clubNavigationTarget, safeCatalogReturn } from './catalogNavigation.js'
const filters = new URLSearchParams({ q: 'Книга', genre: 'Фентезі', format: 'online', reading: '1', mine: '1', sort: 'members-desc', language: 'UA+EN', members: '6-10', meeting: '1' })
const catalog = `/clubs?${filters}`
const location = { pathname: '/clubs/c/books', search: `?${new URLSearchParams({ returnTo: catalog, status: 'planned' })}` }
test('catalog return accepts only the fixed catalog path and known filter keys', () => {
  expect(safeCatalogReturn(catalog)).toBe(catalog)
  expect(safeCatalogReturn('/clubs?q=hello&unknown=x')).toBe('/clubs?q=hello')
})
test.each(['https://evil.test/clubs?q=x', '//evil.test/clubs?q=x', '/clubs/evil?q=x', '/clubs/?q=x', '/clubs#x', '/clubs?q=x#hash', '/clubs?returnTo=%2Fclubs%3Fq%3Dx', '/clubs\\evil?q=x', '/clubs?x=1', '%2Fclubs%3Fq%3Dx', '/clubs?\nq=x', '/clubs?q=' + 'x'.repeat(8192)])('rejects unsafe or unnecessary return URL: %s', (value) => {
  expect(safeCatalogReturn(value)).toBeNull()
  expect(clubNavigationTarget('/clubs', { pathname: '/clubs/c', search: `?${new URLSearchParams({ returnTo: value })}` })).toBe('/clubs')
})
test('context stays flat over nested club links and preserves their own queries', () => {
  let target = clubNavigationTarget('/clubs/c', { pathname: '/clubs', search: `?${filters}` })
  for (const path of ['/clubs/c/books?status=current', '/clubs/c/polls', '/clubs/c/meetings/m/edit', '/clubs/c/discussions/d?comments=2']) {
    const url = new URL(target, 'https://readhub.test')
    target = clubNavigationTarget(path, { pathname: url.pathname, search: url.search })
    const next = new URL(target, 'https://readhub.test')
    expect(next.searchParams.getAll('returnTo')).toEqual([catalog])
    expect(new URL(next.searchParams.get('returnTo'), next.origin).searchParams.has('returnTo')).toBe(false)
  }
  expect(clubNavigationTarget('/clubs', location)).toBe(catalog)
  expect(new URL(clubNavigationTarget('/clubs/c', { pathname: '/clubs/', search: `?${filters}` }), 'https://readhub.test').searchParams.get('returnTo')).toBe(catalog)
  expect(clubNavigationTarget({ pathname: '/clubs/c', search: '?tab=x', hash: '#top' }, location)).toEqual({ pathname: '/clubs/c', search: `?${new URLSearchParams({ tab: 'x', returnTo: catalog })}`, hash: '#top' })
})
test('no context is added to plain catalogs, my clubs, unrelated routes or another club', () => {
  expect(clubNavigationTarget('/clubs/c', { pathname: '/clubs', search: '' })).toBe('/clubs/c')
  expect(clubNavigationTarget('/clubs/c', { pathname: '/my-clubs', search: '?q=other' })).toBe('/clubs/c')
  expect(clubNavigationTarget('/clubs/other', location)).toBe('/clubs/other')
  expect(clubNavigationTarget('/requests/new', location)).toBe('/requests/new')
  expect(clubNavigationTarget('/clubs/new', { pathname: '/clubs', search: '?q=x' })).toBe('/clubs/new')
  expect(clubNavigationTarget('/clubs?q=explicit', location)).toBe('/clubs?q=explicit')
})
