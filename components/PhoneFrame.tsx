import type { ReactNode } from 'react'

type Section = 'home' | 'explore' | 'bookings' | 'profile' | null

// Phone-style screen container. Full-screen on Android/iPhone, wide responsive layout on desktop.
// The bottom navigation now lives in the root layout (it knows if you are logged in).
export default function PhoneFrame({ children, active = null, fullBleed = false }: { children: ReactNode; active?: Section; fullBleed?: boolean }) {
  return <div className={`phone-wrap${fullBleed ? ' phone-wrap-fullbleed' : ''}`}>
    <section className={`phone${active ? '' : ' phone-welcome'}${fullBleed ? ' phone-fullbleed' : ''}`}>
      <div className={`scr${fullBleed ? ' scr-fullbleed' : ''}`}>{children}</div>
    </section>
  </div>
}
