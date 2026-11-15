import { createClient } from '@supabase/supabase-js'
// Server-only. Needed just to create accounts / set temporary passwords from the admin dashboard.
export function serviceClient() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!k) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (server only, never NEXT_PUBLIC) and restart npm run dev.')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, k, { auth: { persistSession: false } })
}
