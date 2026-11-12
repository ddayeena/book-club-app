import { beforeEach, expect, test, vi } from 'vitest'
import { profileService } from './profileService.js'
import { getSupabase } from './supabaseClient.js'
import { currentUserId } from './authService.js'
vi.mock('./supabaseClient.js', () => ({ getSupabase: vi.fn() }))
vi.mock('./authService.js', () => ({ currentUserId: vi.fn() }))
const oldPath = 'a/00000000-0000-4000-8000-000000000001.png'
const row = { id: 'a', name: 'Читач', avatar_path: oldPath, reminders_enabled: true, created_at: '2026-11-12' }
const draft = { name: ' Читач ', remindersEnabled: true, role: 'admin', id: 'b' }
let client, query, result, storage
const png = () => new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'avatar.png', { type: 'image/png' })
beforeEach(() => {
  vi.resetAllMocks(); currentUserId.mockReturnValue('a')
  result = { data: row, error: null }
  query = { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) }
  for (const method of ['select','eq','is','single','update','abortSignal']) query[method] = vi.fn(() => query)
  storage = { upload: vi.fn().mockResolvedValue({ data: {}, error: null }), remove: vi.fn().mockResolvedValue({ data: [{}], error: null }),
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://storage.example.test/image' }, error: null }) }
  client = { from: vi.fn(() => query), storage: { from: vi.fn(() => storage) } }; getSupabase.mockReturnValue(client)
})
test('reads only own profile and whitelists editable fields', async () => {
  const signal = new AbortController().signal
  expect(await profileService.get({ signal })).toMatchObject({ id: 'a', avatarPath: oldPath })
  expect(query.eq).toHaveBeenCalledWith('id', 'a'); expect(query.abortSignal).toHaveBeenCalledWith(signal)
  await profileService.save(draft)
  expect(query.update).toHaveBeenCalledWith({ name: 'Читач', reminders_enabled: true })
  expect(storage.upload).not.toHaveBeenCalled()
})
test('replacement uploads a unique object, compares previous path, then cleans old object', async () => {
  await profileService.save(draft, { avatarFile: png(), previousAvatar: oldPath })
  const path = storage.upload.mock.calls[0][0]
  expect(path).toMatch(/^a\/[0-9a-f-]+\.png$/)
  expect(storage.upload.mock.calls[0][2]).toMatchObject({ upsert: false, contentType: 'image/png' })
  expect(query.eq).toHaveBeenCalledWith('avatar_path', oldPath)
  expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ avatar_path: path }))
  expect(storage.remove).toHaveBeenCalledWith([oldPath])
  expect(storage.upload.mock.invocationCallOrder[0]).toBeLessThan(query.update.mock.invocationCallOrder[0])
  expect(query.update.mock.invocationCallOrder[0]).toBeLessThan(storage.remove.mock.invocationCallOrder[0])
})
test('failed upload or validation never modifies the current profile', async () => {
  await expect(profileService.save(draft, { avatarFile: new File(['bad'], 'x.svg', { type: 'image/svg+xml' }) })).rejects.toMatchObject({ code: 'VALIDATION' })
  expect(storage.upload).not.toHaveBeenCalled()
  storage.upload.mockResolvedValue({ error: { code: 'StorageError' } })
  await expect(profileService.save(draft, { avatarFile: png(), previousAvatar: oldPath })).rejects.toMatchObject({ code: 'StorageError' })
  expect(query.update).not.toHaveBeenCalled(); expect(storage.remove).not.toHaveBeenCalledWith([oldPath])
})
test('failed CAS cleans only uncommitted new file and preserves old path', async () => {
  result = { data: null, error: { code: 'PGRST116' } }
  await expect(profileService.save(draft, { avatarFile: png(), previousAvatar: oldPath })).rejects.toBeTruthy()
  expect(storage.remove).toHaveBeenCalledWith([storage.upload.mock.calls[0][0]])
  expect(storage.remove).not.toHaveBeenCalledWith([oldPath])
})
test('remove clears reference first; cleanup errors report saved state with a warning', async () => {
  storage.remove.mockResolvedValue({ error: { code: 'network' } })
  const saved = await profileService.save(draft, { removeAvatar: true, previousAvatar: oldPath })
  expect(query.update).toHaveBeenCalledWith({ name: 'Читач', reminders_enabled: true, avatar_path: null })
  expect(saved.warning).toContain('Профіль збережено')
})
test('fresh signed URLs expire in 120s and cannot be requested for another account', async () => {
  await expect(profileService.signedAvatar('b/00000000-0000-4000-8000-000000000001.png', 'a')).rejects.toMatchObject({ code: 'AVATAR_PATH' })
  expect(storage.createSignedUrl).not.toHaveBeenCalled()
  expect(await profileService.signedAvatar(oldPath, 'a')).toContain('https://')
  expect(storage.createSignedUrl).toHaveBeenCalledWith(oldPath, 120)
})
test('account switch during upload cannot update the prior profile or clean files as another user', async () => {
  storage.upload.mockImplementation(async () => { currentUserId.mockReturnValue('b'); return { data: {}, error: null } })
  await expect(profileService.save(draft, { avatarFile: png(), previousAvatar: oldPath })).rejects.toMatchObject({ code: 'SESSION_CHANGED' })
  expect(query.update).not.toHaveBeenCalled(); expect(storage.remove).not.toHaveBeenCalled()
})
