import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const envOk = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function supabaseServer() {
  if (!envOk()) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Fill .env.local, then stop and restart "npm run dev".')
  const c = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => c.getAll(), setAll: (l) => { try { l.forEach(({ name, value, options }) => c.set(name, value, options)) } catch {} } },
  })
}

// Guards for app/admin and app/partner layouts (server-side, not just hidden buttons)
export async function requireRole(roles: string[]) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (!p || !roles.includes(p.role)) redirect('/')
  return user
}
