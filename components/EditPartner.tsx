'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
export default function EditPartner({ o }: { o: { id: string; business_name: string; phone?: string; email?: string; address?: string } }) {
  const r = useRouter(), [msg, setMsg] = useState('')
  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget))
    const res = await fetch(`/api/admin/partners/${o.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'update', ...f }) })
    res.ok ? r.refresh() : setMsg((await res.json().catch(() => ({}))).error || 'Failed')
  }
  return (<details style={{ margin: '6px 0' }}><summary style={{ cursor: 'pointer' }}>Edit details</summary><form onSubmit={go} className="row" style={{ marginTop: 8 }}>
    <div><label>Business name</label><input name="business_name" defaultValue={o.business_name} /></div><div><label>Phone</label><input name="phone" defaultValue={o.phone || ''} /></div><div><label>Email</label><input name="email" defaultValue={o.email || ''} /></div><div><label>Address</label><input name="address" defaultValue={o.address || ''} /></div>
    <div>{msg && <small className="err">{msg}</small>}<button className="btn sm">Save</button></div></form></details>)
}
