import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return NextResponse.next() // pages show a clear setup error
  let res = NextResponse.next({ request: req })
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => req.cookies.getAll(), setAll: (l) => { l.forEach(({ name, value }) => req.cookies.set(name, value)); res = NextResponse.next({ request: req }); l.forEach(({ name, value, options }) => res.cookies.set(name, value, options)) } },
  })
  const { data: { user } } = await sb.auth.getUser() // also refreshes the session
  const p = req.nextUrl.pathname
  if (!user && /^\/(bookings|partner|admin|apply|portal)/.test(p)) { const u = req.nextUrl.clone(); u.pathname = '/login'; u.search = `?next=${p}`; return NextResponse.redirect(u) }
  return res
}
export const config = { matcher: ['/((?!_next|favicon.ico|icon.svg|manifest.webmanifest).*)'] }
