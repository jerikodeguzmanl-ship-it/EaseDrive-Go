'use client'
import Link from 'next/link'
import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

function Inner({ loggedIn }: { loggedIn: boolean }) {
  const p = usePathname(), sp = useSearchParams()
  if (p.startsWith('/partner') || p.startsWith('/admin')) return null
  const explore = (p === '/' && sp.get('view') === 'explore') || p.startsWith('/vehicles')
  return (<nav className="bnav" aria-label="Main">
    <Link href="/" className={p === '/' && !explore ? 'on' : ''}>Home</Link>
    <Link href="/?view=explore" className={explore ? 'on' : ''}>Explore</Link>
    <Link href={loggedIn ? '/bookings' : '/login?next=/bookings'} className={p.startsWith('/bookings') ? 'on' : ''}>Bookings</Link>
    {loggedIn ? <form action="/auth/signout" method="post"><button>Log out</button></form> : <Link href="/login" className={p.startsWith('/login') ? 'on' : ''}>Log in</Link>}
  </nav>)
}
export default function BottomNav(props: { loggedIn: boolean }) { return <Suspense fallback={null}><Inner {...props} /></Suspense> }
