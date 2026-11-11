import { getSupabase } from './supabaseClient.js'
import { ServiceError } from './ServiceError.js'
import { validateLogin, validateRegistration } from '../domain/authValidation.js'

let activeUser = null
export function setActiveUser(user) { activeUser = user }
export function currentUserId() { return activeUser?.id ?? null }

function check(error) {
  if (!error) return
  const messages = {
    invalid_credentials: 'Невірна пошта або пароль.',
    email_not_confirmed: 'Підтвердьте пошту перед входом.',
    over_email_send_rate_limit: 'Ліміт листів вичерпано. Спробуйте пізніше.',
    user_banned: 'Обліковий запис заблоковано.',
  }
  throw new ServiceError(messages[error.code] ?? 'Не вдалося виконати запит авторизації. Спробуйте ще раз.', { code: error.code ?? 'AUTH' })
}
export async function getSession() {
  const { data, error } = await getSupabase().auth.getSession()
  check(error)
  return data.session
}
export function subscribe(callback) {
  return getSupabase().auth.onAuthStateChange((_event, session) => callback(session)).data.subscription
}
export async function getSessionUser(session) {
  if (!session) return null
  const client = getSupabase()
  const id = session.user.id
  const [profile, access] = await Promise.all([
    client.from('profiles').select('id,name,avatar_path,reminders_enabled').eq('id', id).single(),
    client.from('user_access').select('role,is_blocked').eq('user_id', id).single(),
  ])
  if (profile.error || access.error || !profile.data || !access.data) {
    throw new ServiceError('Не вдалося завантажити профіль і права доступу. Перевірте міграції та повторіть спробу.', { code: 'PROFILE' })
  }
  if (access.data.is_blocked) throw new ServiceError('Обліковий запис заблоковано.', { code: 'BLOCKED' })
  if (!['user', 'admin'].includes(access.data.role)) throw new ServiceError('Невідомі права доступу.', { code: 'ACCESS' })
  return { id, name: profile.data.name, email: session.user.email, role: access.data.role,
    remindersEnabled: profile.data.reminders_enabled, avatarPath: profile.data.avatar_path }
}
function validate(input, validator) {
  const result = validator(input)
  if (!result.ok) throw new ServiceError('Перевірте поля форми.', { code: 'VALIDATION', errors: result.errors })
  return result.value
}
export async function login(input) {
  const { data, error } = await getSupabase().auth.signInWithPassword(validate(input, validateLogin))
  check(error)
  return data.session
}
export async function register(input) {
  const { name, email, password } = validate(input, validateRegistration)
  const { data, error } = await getSupabase().auth.signUp({
    email, password,
    options: { data: { name }, emailRedirectTo: window.location.origin + '/login' },
  })
  check(error)
  return data.session
}
export async function logout() {
  const { error } = await getSupabase().auth.signOut({ scope: 'local' })
  check(error)
  setActiveUser(null)
}
