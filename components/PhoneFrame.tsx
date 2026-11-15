import type { ReactNode } from 'react'

type Section = 'home' | 'explore' | 'bookings' | 'profile' | null

// Phone-style screen container. Full-screen on Android/iPhone, wide responsive layout on desktop.
// The bottom navigation now lives in the root layout (it knows if you are logged in).
export default function PhoneFrame({ children, active = null }: { children: ReactNode; active?: Section }) {
  return <div className="phone-wrap"><section className={'phone' + (active ? '' : ' phone-welcome')}><div className="scr">{children}</div></section></div>
}
