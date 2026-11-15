'use client'
import { useEffect, useState } from 'react'
import { tone } from '@/lib/format'
import PhoneFrame from '@/components/PhoneFrame'

const STEPS = ['Submitted', 'Under Review', 'Documents Required', 'Awaiting Agreement', 'Approved']
export default function Apply() {
  const [apps, setApps] = useState<any[]>([]), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  const load = () => fetch('/api/applications').then((r) => r.json()).then((j) => Array.isArray(j) && setApps(j))
  useEffect(() => { load() }, [])
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); const file = f.get('permit') as File
    setBusy(true); setMsg('')
    const body = Object.fromEntries(['business_name', 'owner_name', 'email', 'phone', 'address', 'description', 'vehicle_count'].map((k) => [k, f.get(k)]))
    const res = await fetch('/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), a = await res.json()
    if (!res.ok) { setBusy(false); return setMsg(a.error) }
    if (file?.size) {
      const up = new FormData(); up.set('file', file); up.set('applicationId', a.id); up.set('kind', 'Business permit')
      const d = await fetch('/api/documents', { method: 'POST', body: up })
      if (!d.ok) { const result = await d.json(); setBusy(false); setMsg('Application saved but the permit upload failed: ' + result.error); load(); form.reset(); return }
    }
    setBusy(false); setMsg('Application submitted. A business permit is optional; a signed partnership agreement is required for approval.'); load(); form.reset()
  }
  const I = (n: string, l: string, t = 'text') => <><label>{l}</label><input name={n} type={t} required /></>
  return (<PhoneFrame active="profile"><div className="customer-screen"><div className="narrow" style={{ margin: '0 auto' }}><h1>Become a rental partner</h1><p style={{ color: 'var(--m)', margin: '6px 0 14px' }}>Only approved partners can publish vehicles and accept bookings. A business permit is optional; the signed partnership agreement is required for approval.</p>
    {apps.map((a) => { const cur = STEPS.indexOf(a.status); return <div key={a.id} className="panel"><b>{a.business_name}</b> <span className={'pill ' + tone(a.status)}>{a.status}</span>{STEPS.map((s, i) => <div key={s} style={{ padding: '6px 0', color: i <= cur ? 'var(--t)' : 'var(--m)' }}>{i <= cur ? '✓' : '○'} {s}</div>)}{a.admin_notes && <small>Note: {a.admin_notes}</small>}</div> })}
    <form className="panel" onSubmit={submit}><h3>New application</h3>{I('business_name', 'Business name')}{I('owner_name', "Owner's full name")}{I('email', 'Business email', 'email')}{I('phone', 'Contact number')}{I('address', 'Complete business address')}{I('vehicle_count', 'Number of vehicles', 'number')}
      <label>Business description</label><textarea name="description" rows={3} /><label>Business permit (optional, PDF/JPG/PNG, max 5MB)</label><input name="permit" type="file" accept=".pdf,image/png,image/jpeg" />
      {msg && <small className="err">{msg}</small>}<button className="btn full" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</button>
      <small style={{ color: 'var(--m)' }}>After review, our team will arrange the required partnership agreement.</small></form></div></div></PhoneFrame>)
}
