'use client'
import { useState } from 'react'
export default function BlockForm({ vehicles }: { vehicles: { id: string; name: string }[] }) {
  const [msg, setMsg] = useState('')
  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    const r = await fetch(`/api/vehicles/${f.get('v')}/block`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ start: f.get('s'), end: f.get('e'), reason: f.get('r') }) })
    setMsg(r.ok ? 'Dates blocked.' : (await r.json()).error)
  }
  return (<form className="panel" onSubmit={go}><h3>Block dates / maintenance</h3><div className="row"><div><label>Vehicle</label><select name="v">{vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div><div><label>From</label><input name="s" type="date" required /></div><div><label>To</label><input name="e" type="date" required /></div><div><label>Reason</label><select name="r"><option>Maintenance</option><option>Unavailable</option></select></div></div>{msg && <small className="err">{msg}</small>}<button className="btn sm">Block</button></form>)
}
