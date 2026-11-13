// Run once from the repository root: node supabase/demo/auth-demo.mjs
import { createClient } from '@supabase/supabase-js'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'

const names = ['Соломія Коваль','Марко Левицький','Олена Савчук','Андрій Мельник','Ірина Бондар','Тарас Шевчук','Наталія Романюк','Богдан Ткаченко','Дарина Мороз','Остап Кравець','Юлія Поліщук','Дмитро Гончар','Вероніка Лисенко','Роман Дорошенко','Катерина Сидоренко','Михайло Козак','Софія Павленко','Назар Климчук','Анастасія Бойко','Павло Руденко','Христина Іванюк','Денис Петренко','Зоряна Остапчук','Владислав Костенко']
const email = i => `readhub.reader.${String(i+1).padStart(2,'0')}@example.com`
function requireThat(ok, message) { if (!ok) throw Object.assign(new Error(message), { localMessage:true }) }
async function checked(request, operation) {
  const { data, error } = await request
  requireThat(!error, `${operation}: відмова API. Виконання зупинено; перевірте ключ, права й порядок кроків.`)
  return data
}
async function allUsers(client) {
  const result = []
  for (let page=1;;page++) {
    const { users } = await checked(client.auth.admin.listUsers({ page, perPage:100 }), 'Читання Auth')
    result.push(...users)
    if (users.length<100) return result
  }
}
async function replaceUsers(client) {
  async function count(table) {
    const result = await client.from(table).select('*', { count:'exact', head:true })
    requireThat(!result.error, `Не вдалося перевірити ${table}.`)
    return result.count
  }
  for (const table of ['clubs','profiles','user_access']) {
    requireThat(await count(table)===0, `Таблиця ${table} не порожня. Потрібен завершений 01_cleanup.sql; старі профілі не використовуються.`)
  }
  const oldUsers = await allUsers(client)
  const oldIds = new Set(oldUsers.map(u=>u.id)) // memory only, no saved old records
  const bucket = await checked(client.storage.getBucket('avatars'), 'Перевірка avatars')
  requireThat(bucket.id==='avatars' && bucket.public===false, 'Очікується приватний bucket avatars.')
  // Remove physical objects before deleting their Auth owners; preserve the bucket.
  await checked(client.storage.emptyBucket('avatars'), 'Очищення avatars')
  let empty = false
  for (let attempt=0;attempt<60;attempt++) {
    const objects = await checked(client.storage.from('avatars').list('', { limit:1 }), 'Перевірка очищення avatars')
    if (!objects.length) { empty=true; break }
    await delay(500)
  }
  requireThat(empty, 'Storage ще очищується. Створення користувачів не починалося; повторіть скрипт пізніше.')
  for (const user of oldUsers) await checked(client.auth.admin.deleteUser(user.id,false), 'Видалення старого Auth-акаунта')
  requireThat((await allUsers(client)).length===0, 'В Auth залишились акаунти або відбулася паралельна реєстрація. Створення не почалося.')

  const batch = randomUUID(), newIds = new Set()
  for (let i=0;i<24;i++) {
    // ALWAYS create: no lookup/adoption of existing users, including old demo emails.
    const { user } = await checked(client.auth.admin.createUser({
      email:email(i), password:randomBytes(36).toString('base64url'), email_confirm:true,
      user_metadata:{ name:names[i] },
      app_metadata:{ readhub_demo_version:'fresh-v2', readhub_demo_batch:batch, readhub_demo_index:i+1 },
    }), 'Створення нового демоакаунта')
    requireThat(user && !oldIds.has(user.id) && !newIds.has(user.id) && user.email_confirmed_at, 'Новий UUID або підтвердження email некоректні.')
    newIds.add(user.id)
    const profile = await checked(client.from('profiles').select('name').eq('id',user.id).single(), 'Перевірка нового профілю')
    const access = await checked(client.from('user_access').select('role,is_blocked').eq('user_id',user.id).single(), 'Перевірка ролі')
    requireThat(profile.name===names[i] && access.role==='user' && !access.is_blocked, 'Тригер 002 не створив очікуваний профіль із роллю user.')
  }
  const actual = await allUsers(client)
  requireThat(actual.length===24 && actual.every(u=>newIds.has(u.id) && !oldIds.has(u.id)
    && u.app_metadata?.readhub_demo_version==='fresh-v2' && u.app_metadata?.readhub_demo_batch===batch), 'Підсумковий набір Auth-акаунтів не збігається з новим пакетом.')
  requireThat(await count('profiles')===24 && await count('user_access')===24, 'Очікуються рівно 24 нові профілі та ролі.')
  console.log(`Готово: старих Auth-акаунтів видалено ${oldUsers.length}; avatars очищено; створено 24 НОВІ акаунти з роллю user. Тепер виконайте readhub_demo.sql.`)
}
async function main() {
  requireThat(process.stdin.isTTY, 'Запустіть команду у звичайному інтерактивному терміналі Windows.')
  let hidden = false
  const output = new Writable({ write(chunk, encoding, done) { if (!hidden) process.stdout.write(chunk,encoding); done() } })
  const rl = createInterface({ input:process.stdin, output, terminal:true })
  try {
    // Read only the frontend URL, never its keys; do not change .env.local.
    let url = ''
    try { url = readFileSync(new URL('../../.env.local',import.meta.url),'utf8').match(/^\s*VITE_SUPABASE_URL\s*=\s*["']?(https:\/\/[a-z0-9]{20}\.supabase\.co)\/?["']?\s*$/m)?.[1] ?? '' } catch { /* ask below */ }
    if (!url) url = (await rl.question('URL основного readhub із Dashboard: ')).trim().replace(/\/$/,'')
    const ref = url.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co$/)?.[1]
    requireThat(ref, 'Некоректний Supabase URL.')
    console.log(`Проєкт: ${url}\nУ Dashboard звірте назву readhub та Project reference. Усі старі Auth-акаунти цього проєкту будуть видалені.`)
    const confirmation = await rl.question('Для підтвердження введіть readhub і Project reference з Dashboard через пробіл: ')
    requireThat(confirmation.trim()===`readhub ${ref}`, 'Назва/ref не збігаються. Видалення не розпочато.')
    process.stdout.write('Secret key / service_role key (ввід прихований): ')
    hidden = true
    let key
    try { key=(await rl.question('')).trim() } finally { hidden=false; process.stdout.write('\n') }
    requireThat(key && (key.startsWith('sb_secret_') || key.startsWith('eyJ')), 'Потрібен серверний secret key або service_role JWT.')
    if (key.startsWith('eyJ')) {
      let payload
      try { payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString('utf8')) } catch { /* rejected below */ }
      requireThat(payload?.role==='service_role' && payload?.ref===ref, 'Service role key належить іншому проєкту або має неправильну роль.')
    }
    const client = createClient(url,key,{ auth:{ persistSession:false,autoRefreshToken:false } })
    rl.close()
    await replaceUsers(client)
  } finally { rl.close() }
}
main().catch(error => {
  console.error(error.localMessage ? error.message : 'Помилка мережі або API; серверні відповіді й секрети приховано.')
  process.exitCode=1
})
