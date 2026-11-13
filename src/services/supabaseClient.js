import { createClient } from '@supabase/supabase-js'
import { ServiceError } from './ServiceError.js'

let client
export function getSupabase() {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key || !key.startsWith('sb_publishable_')) {
    throw new ServiceError('Налаштуйте VITE_SUPABASE_URL і публічний VITE_SUPABASE_PUBLISHABLE_KEY.', { code: 'CONFIG' })
  }
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return client
}
