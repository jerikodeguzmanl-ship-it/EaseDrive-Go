import './globals.css'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import type { Viewport } from 'next'
import { supabaseServer } from '@/lib/supabase/server'
import BottomNav from '@/components/BottomNav'

export const metadata = { title: 'EaseDrive Go', description: 'Your Journey, Your Choice.' }
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#202020' }

export default async function Root({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  const { data: profile } = user
    ? await sb.from('profiles').select('role').eq('id', user.id).maybeSingle()
    : { data: null }
  const role = profile?.role === 'admin' || profile?.role === 'owner' ? profile.role : null
  const dashboardHref = role === 'admin' ? '/admin' : role === 'owner' ? '/partner' : null
  const dashboardLabel = role === 'admin' ? 'Admin dashboard' : 'Partner dashboard'
  return (<html lang="en" data-theme="light"><body>
    <header className="top"><Link href="/" className="logo"><i>E</i>EaseDrive Go</Link>
      <nav className="tabs" aria-label="Main navigation">
        <Link href="/?view=explore">Explore</Link>
        {user && <Link href="/bookings">My Bookings</Link>}
        {dashboardHref && <Link href={dashboardHref}>{dashboardLabel}</Link>}
      </nav>
      {user ? <form action="/auth/signout" method="post"><button className="btn sm">Log out</button></form> : <Link href="/login" className="btn sm">Log in</Link>}
    </header>
    <main className="page-main">{children}</main>
    <footer className="foot"><span>© EaseDrive Go · Walang online payment sa ngayon</span><Link href="/apply">Become a rental partner</Link><Link href="/portal">Partner portal</Link></footer>
    <BottomNav loggedIn={!!user} role={role} /></body></html>)
}
