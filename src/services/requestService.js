import { mockRequestService } from './mockRequestService.js'
import { createApiRequestService } from './apiRequestService.js'

const source = import.meta.env.VITE_DATA_SOURCE ?? 'mock'

function selectService() {
  if (source === 'mock') return mockRequestService
  if (source === 'api') {
    return createApiRequestService(import.meta.env.VITE_API_BASE_URL)
  }
  throw new Error(`Unsupported data source: ${source}`)
}

export const requestService = selectService()