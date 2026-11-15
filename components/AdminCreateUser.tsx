'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
export default function AdminCreateUser({ role }: { role: 'customer' | 'owner' }) {
  const r = useRouter(), [open, setOpen] = useState(false), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMsg('')
    const f = Object.fromEntries(new FormData(e.currentTarget)), res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, role }) })
    setBusy(false); const j = await res.json().catch(() => ({})); if (!res.ok) return setMsg(j.error || 'Failed'); setOpen(false); r.refresh()
  }
  if (!open) return <button className="btn sm" onClick={() => setOpen(true)}>+ Add {role === 'owner' ? 'partner' : 'customer'}</button>
  return (<form className="panel" onSubmit={go}><h3>Add {role === 'owner' ? 'partner (approved)' : 'customer'}</h3><div className="row">
    <div><label>Full name</label><input name="full_name" required /></div><div><label>Email</label><input name="email" type="email" required /></div><div><label>Temporary password (8+)</label><input name="password" type="text" minLength={8} required /></div><div><label>Phone</label><input name="phone" /></div>
    {role === 'owner' && <><div><label>Business name</label><input name="business_name" required /></div><div><label>Business address</label><input name="address" /></div></>}</div>
    {msg && <small className="err">{msg}</small>}<button className="btn sm" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button> <button type="button" className="btn sm dk" onClick={() => setOpen(false)}>Cancel</button></form>)
}
