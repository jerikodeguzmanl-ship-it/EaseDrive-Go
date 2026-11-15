'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
// Generic button that calls an API route, shows errors, then refreshes the server data.
export default function Action({ url, method = 'PATCH', body, label, confirmMsg, ask, className = 'btn sm' }: { url: string; method?: string; body?: any; label: string; confirmMsg?: string; ask?: string; className?: string }) {
  const r = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  async function go() {
    if (confirmMsg && !confirm(confirmMsg)) return
    const b: any = { ...(body || {}) }
    if (ask) { const t = prompt(ask); if (t === null) return; b.reason = t }
    setBusy(true); setErr('')
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
    setBusy(false)
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error || 'Failed'); return }
    r.refresh()
  }
  return <><button className={className} disabled={busy} onClick={go}>{busy ? '…' : label}</button>{err && <small className="err">{err}</small>}</>
}
