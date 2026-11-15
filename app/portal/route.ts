import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
// Hidden entry: sends each role to its own dashboard (customer -> home, partner -> /partner, admin -> /admin)
export async function GET(req: Request) {
  const sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser(), url = new URL(req.url)
  if (!user) return NextResponse.redirect(new URL('/login?next=/portal', url))
  const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
  return NextResponse.redirect(new URL(p?.role === 'admin' ? '/admin' : p?.role === 'owner' ? '/partner' : '/', url))
}
