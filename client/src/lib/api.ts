// Central API base URL — used by all frontend API calls
// Priority: Vite env var → hardcoded Railway URL → same-origin
const RAILWAY_URL = 'https://web-production-67f2.up.railway.app'

export const API_BASE = import.meta.env.VITE_API_URL || RAILWAY_URL
