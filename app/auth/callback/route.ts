import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
// Email confirmation + password reset links land here
export async function GET(req: Request) {
  const u = new URL(req.url), code = u.searchParams.get('code'), next = u.searchParams.get('next') || '/portal'
  if (code) { const sb = await supabaseServer(); const { error } = await sb.auth.exchangeCodeForSession(code); if (error) return NextResponse.redirect(new URL('/login?error=link', u)) }
  return NextResponse.redirect(new URL(next.startsWith('/') && !next.startsWith('//') ? next : '/portal', u))
}
