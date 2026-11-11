import { mockRequestService } from './mockRequestService.js'
import { createApiRequestService } from './apiRequestService.js'
import { supabaseRequestService } from './supabaseRequestService.js'
import { isSupabaseData } from './dataSource.js'

const source = import.meta.env.MODE === 'test' ? 'mock' : 'supabase'

function selectService() {
  if (isSupabaseData) return supabaseRequestService
  if (source === 'mock') return mockRequestService
  if (source === 'api') {
    return createApiRequestService(import.meta.env.VITE_API_BASE_URL)
  }
  throw new Error(`Unsupported data source: ${source}`)
}

export const requestService = selectService()
