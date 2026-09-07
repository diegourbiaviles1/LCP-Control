import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
const parsedUrl = url ? URL.parse(url) : null
// Fail closed: only modern public keys accepted. No legacy JWT keys or service keys.
export const authConfigured =
  parsedUrl?.protocol === 'https:' && !!key?.startsWith('sb_publishable_')
export const supabase = authConfigured
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null
