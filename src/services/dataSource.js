// Local fixtures are available only in tests. Production never reads legacy data.
export const isSupabaseData = import.meta.env.MODE !== 'test'
