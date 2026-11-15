'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BookingRefresh() {
  const router = useRouter()

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh()
    }, 15000)

    return () => window.clearInterval(timer)
  }, [router])

  return <button type="button" className="btn sm dk" onClick={() => router.refresh()}>Refresh bookings</button>
}
