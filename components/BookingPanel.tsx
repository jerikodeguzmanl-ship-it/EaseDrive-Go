'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { P } from '@/lib/format'

const iso = (d: Date) => d.toISOString().slice(0, 10)
const addD = (s: string, n: number) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
const today = iso(new Date(Date.now() - new Date().getTimezoneOffset() * 60000))
const HARD = ['Confirmed', 'Maintenance', 'Unavailable']

export default function BookingPanel({ vehicleId, seats, partner }: { vehicleId: string; seats: number; partner: any }) {
  const r = useRouter()
  const [service, setService] = useState('self_drive'), [start, setStart] = useState(''), [end, setEnd] = useState('')
  const [delivery, setDelivery] = useState(false), [time, setTime] = useState('09:00'), [pass, setPass] = useState(2)
  const [idInfo, setIdInfo] = useState<any>(null), [idType, setIdType] = useState("Driver's License"), [idFile, setIdFile] = useState<File | null>(null)
  const [address, setAddress] = useState(''), [notes, setNotes] = useState('')
  const [busy, setBusy] = useState<Record<string, string>>({}), [q, setQ] = useState<any>(null), [msg, setMsg] = useState(''), [done, setDone] = useState<any>(null), [sending, setSending] = useState(false), [mo, setMo] = useState(0)

  useEffect(() => { // restore draft after login so nothing is lost
    const d = sessionStorage.getItem('draft:' + vehicleId); if (d) { const x = JSON.parse(d); setService(x.service); setStart(x.start); setEnd(x.end); setDelivery(x.delivery); setTime(x.time); setPass(x.pass); setAddress(x.address); setNotes(x.notes) }
    fetch('/api/ids').then((x) => x.json()).then(setIdInfo).catch(() => {})
    fetch(`/api/vehicles/${vehicleId}/busy`).then((x) => x.json()).then((rows) => {
      const m: Record<string, string> = {}
      if (Array.isArray(rows)) rows.forEach((row: any) => { const k = String(row.period).match(/([\[(])(\d{4}-\d\d-\d\d),(\d{4}-\d\d-\d\d)([\])])/); if (!k) return
        let s = k[2], e = k[4] === ')' ? k[3] : addD(k[3], 1); for (; s < e; s = addD(s, 1)) if (m[s] !== 'Confirmed') m[s] = row.kind })
      setBusy(m) }).catch(() => {})
  }, [vehicleId])

  useEffect(() => { // server-side computation, never computed in the browser
    setQ(null); setMsg(''); if (!start || !end) return
    fetch('/api/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vehicleId, service, start, end, delivery }) })
      .then(async (x) => { const j = await x.json().catch(() => ({ error: 'Could not compute the price. Try again.' })); x.ok ? setQ(j) : setMsg(j.error) }).catch(() => setMsg('Network error. Check your connection.'))
  }, [start, end, service, delivery, vehicleId])

  function pick(d: string) {
    if (d < today || HARD.includes(busy[d])) return
    if (!start || end || d < start) { setStart(d); setEnd(''); return }
    for (let s = start; s <= d; s = addD(s, 1)) if (HARD.includes(busy[s])) { setStart(d); setEnd(''); setMsg('Selected range includes unavailable dates.'); return }
    setEnd(d)
  }
  const cells = useMemo(() => {
    const n = new Date(); const f = new Date(Date.UTC(n.getFullYear(), n.getMonth() + mo, 1)); const days = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)).getUTCDate()
    return { label: f.toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }), lead: f.getUTCDay(), list: [...Array(days)].map((_, i) => iso(new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), i + 1)))) }
  }, [mo])

  async function submit() {
    if (!start || !end) return setMsg('Choose pickup and return dates.')
    if (!address.trim()) return setMsg(delivery ? 'Delivery address is required.' : 'Pickup address is required.')
    if (pass < 1 || pass > seats) return setMsg(`Passengers must be 1 to ${seats}.`)
    const idOk = idInfo && !idInfo.none && !idInfo.error && idInfo.status !== 'Rejected'
    if (!idOk && !idFile) return setMsg('Upload a valid ID (clear photo or PDF). The partner needs it to approve your booking.')
    setSending(true); setMsg('')
    if (!idOk && idFile) {
      const fd = new FormData(); fd.set('file', idFile); fd.set('idType', idType)
      const up = await fetch('/api/ids', { method: 'POST', body: fd }).catch(() => null)
      if (!up) { setSending(false); return setMsg('Network error while uploading your ID.') }
      if (up.status === 401) { setSending(false); sessionStorage.setItem('draft:' + vehicleId, JSON.stringify({ service, start, end, delivery, time, pass, address, notes })); return r.push(`/login?next=/vehicles/${vehicleId}`) }
      const uj = await up.json().catch(() => ({ error: 'ID upload failed.' })); if (!up.ok) { setSending(false); return setMsg(uj.error) }
      setIdInfo(uj)
    }
    const body = { vehicleId, service, start, end, delivery, time, passengers: pass, address, notes }
    const res = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    setSending(false)
    if (!res) return setMsg('Network error. Check your connection and try again.')
    if (res.status === 401) { sessionStorage.setItem('draft:' + vehicleId, JSON.stringify({ service, start, end, delivery, time, pass, address, notes })); return r.push(`/login?next=/vehicles/${vehicleId}`) }
    const j = await res.json().catch(() => ({ error: 'Unexpected server response.' })); if (!res.ok) return setMsg(j.error)
    sessionStorage.removeItem('draft:' + vehicleId); setDone(j)
  }

  if (done) return (<div className="panel"><h2>Request submitted ✅</h2><p style={{ color: 'var(--m)', margin: '6px 0' }}>Not confirmed yet. The rental partner will review your request.</p>
    <p style={{ fontSize: 22, fontWeight: 800 }}>{done.ref}</p><span className="pill o">Pending</span>
    <p style={{ margin: '10px 0' }}>{start} → {end} · {service === 'self_drive' ? 'Self Drive' : 'With Driver'}<br />Estimated total {P(done.total)} · Refundable deposit {P(done.deposit)}<br />{partner?.business_name} · {partner?.phone}</p>
    <a className="btn" href="/bookings">View my bookings</a></div>)

  const row = (l: string, v: any) => <tr><td>{l}</td><td align="right">{v}</td></tr>
  return (<div className="panel stick">
    <h3>Book this vehicle</h3>
    <label>1. Service</label><div className="seg"><button className={service === 'self_drive' ? 'on' : ''} onClick={() => setService('self_drive')}>Self Drive</button><button className={service === 'with_driver' ? 'on' : ''} onClick={() => setService('with_driver')}>With Driver</button></div>
    <label>2. Pickup and return dates</label>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><button className="btn sm dk" disabled={mo < 1} onClick={() => setMo(mo - 1)}>‹</button><b>{cells.label}</b><button className="btn sm dk" onClick={() => setMo(mo + 1)}>›</button></div>
    <div className="cal" style={{ marginTop: 8 }}>{'SMTWTFS'.split('').map((d, i) => <div key={i} className="h">{d}</div>)}{[...Array(cells.lead)].map((_, i) => <div key={'p' + i} />)}
      {cells.list.map((d) => { const k = busy[d], sel = d === start || d === end || (start && end && d > start && d < end); return <div key={d} className={sel ? 'sel' : d < today ? 'x' : k || 'a'} onClick={() => pick(d)}>{+d.slice(8)}</div> })}</div>
    <div className="lg"><span>Pending = awaiting owner (still selectable)</span><span>Blue = confirmed</span><span>Grey = blocked/maintenance</span></div>
    <div className="row"><div><label>Pickup date</label><input readOnly value={start} placeholder="Select" /></div><div><label>Return date</label><input readOnly value={end} placeholder="Select" /></div><div><label>Pickup time</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div><div><label>Passengers (max {seats})</label><input type="number" min={1} max={seats} value={pass} onChange={(e) => setPass(+e.target.value)} /></div></div>
    <label>3. Pickup or delivery</label><div className="seg"><button className={!delivery ? 'on' : ''} onClick={() => setDelivery(false)}>Pickup</button><button className={delivery ? 'on' : ''} onClick={() => setDelivery(true)}>Delivery</button></div>
    <label>{delivery ? 'Delivery' : 'Pickup'} address</label><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City, Province" />
    <label>Valid ID (required)</label>
    {idInfo && !idInfo.none && !idInfo.error && idInfo.status !== 'Rejected' ? <p className="ok" style={{ margin: '4px 0 10px' }}>✓ ID on file: {idInfo.id_type} ({idInfo.status})</p> : <>
      {idInfo?.status === 'Rejected' && <small className="err">Your last ID was rejected. Please upload a new one.</small>}
      <select value={idType} onChange={(e) => setIdType(e.target.value)}>{["Driver's License", 'Passport', 'UMID', 'PhilSys National ID', 'Postal ID', "Voter's ID", 'Other government ID'].map((t) => <option key={t}>{t}</option>)}</select>
      <input type="file" accept="image/*,.pdf" onChange={(e) => setIdFile(e.target.files?.[0] || null)} /><small style={{ color: 'var(--m)', display: 'block', marginBottom: 8 }}>Seen only by you, the rental partner and EaseDrive admin. Max 5MB.</small></>}
    <label>Instructions (optional)</label><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
    <div className="panel" style={{ background: 'var(--bg)' }}><h3>Price computation</h3>
      {!q ? <p className="empty" style={{ padding: 8 }}>Choose service and dates to see the computation.</p> :
        <table className="bk"><tbody>{row(`${service === 'self_drive' ? 'Self Drive' : 'With Driver'} rate`, P(q.rate) + '/day')}{row('Rental days', q.days)}{row('Base rental', P(q.base))}{row('Delivery fee', P(q.delivery_fee))}{row('Additional charges', P(q.extra_fee))}{row('Discount', '-' + P(q.discount))}{row(q.tax_inclusive ? 'VAT (already included)' : 'VAT (added)', P(q.tax))}
          <tr className="tot"><td>Estimated total</td><td align="right">{P(q.total)}</td></tr></tbody></table>}
      {q && <small style={{ color: 'var(--m)' }}>Estimate only; the final amount is recomputed by the server on submit. Refundable security deposit (separate): {P(q.deposit)}.</small>}</div>
    {msg && <small className="err">{msg}</small>}
    <button className="btn full" disabled={sending} onClick={submit}>{sending ? 'Submitting…' : 'SUBMIT BOOKING REQUEST'}</button>
    <small style={{ color: 'var(--m)', display: 'block', marginTop: 8 }}>You will be asked to log in if needed. Your selections are kept.</small></div>)
}
