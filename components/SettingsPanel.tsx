'use client'
import { useState } from 'react'
export default function SettingsPanel({ expiry, review }: { expiry: number; review: boolean }) {
  const [h, setH] = useState(expiry), [rv, setRv] = useState(review), [msg, setMsg] = useState(''), [ok, setOk] = useState(false)
  async function save() {
    setMsg('')
    const put = (key: string, value: any) => fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) })
    const a = await put('pending_expiry_hours', Number(h)), b = await put('require_vehicle_review', rv)
    if (!a.ok || !b.ok) { setOk(false); return setMsg((await (a.ok ? b : a).json().catch(() => ({}))).error || 'Failed') }
    setOk(true); setMsg('Saved.')
  }
  return (<div className="panel"><h3>Platform settings</h3><div className="row"><div><label>Pending booking expires after (hours, 1 to 168)</label><input type="number" min={1} max={168} value={h} onChange={(e) => setH(+e.target.value)} /></div>
    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto', margin: 0 }} checked={rv} onChange={() => setRv(!rv)} />Require admin review before a partner listing goes live</label></div>
    {msg && <small className={ok ? 'ok' : 'err'}>{msg}</small>}<button className="btn sm" onClick={save}>Save settings</button></div>)
}
