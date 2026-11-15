'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function AddVehicleForm({ owners }: { owners?: { id: string; name: string }[] }) {
  const r = useRouter(), [open, setOpen] = useState(false), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [vehicleId, setVehicleId] = useState('')
  const uploadedImages = useRef(new Map<string, { path: string; linked: boolean }>())
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMsg('')
    const f = new FormData(e.currentTarget), g = (k: string) => String(f.get(k) || '')
    const p: any = { name: g('name'), brand: g('brand'), model_year: +g('model_year'), category: g('category'), transmission: g('transmission'), fuel: g('fuel'), seats: +g('seats'), luggage: +g('luggage'), description: g('description'), location: g('location'), features: g('features').split(',').map((s) => s.trim()).filter(Boolean), self_drive_rate: +g('self_drive_rate'), with_driver_rate: +g('with_driver_rate'), delivery_fee: +g('delivery_fee') || 0, additional_fee: +g('additional_fee') || 0, tax_rate: (+g('tax_pct') || 0) / 100, tax_inclusive: g('tax_mode') === 'inc', deposit: +g('deposit') || 0, status: g('publish') ? 'Published' : 'Draft', owner_id: g('owner_id') || undefined }
    let id = vehicleId
    if (!id) {
      const res = await fetch('/api/vehicles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }), v = await res.json()
      if (!res.ok) { setBusy(false); return setMsg(v.error) }
      id = v.id
      setVehicleId(id)
    }
    const files = (f.getAll('images') as File[]).filter((x) => x.size), sb = supabaseBrowser(), { data: { user } } = await sb.auth.getUser()
    if (!user) { setBusy(false); return setMsg('Vehicle saved, but you need to sign in again before uploading photos.') }
    for (let i = 0; i < files.length; i++) {
      const file = files[i], key = `${i}:${file.name}:${file.size}:${file.lastModified}`
      let upload = uploadedImages.current.get(key)
      if (!upload) {
        const extension = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'image'
        const path = `${user.id}/${id}/${crypto.randomUUID()}.${extension}`
        const { error } = await sb.storage.from('vehicles').upload(path, file, { contentType: file.type })
        if (error) { setBusy(false); return setMsg(`Vehicle saved, but photo "${file.name}" could not be uploaded: ${error.message}`) }
        upload = { path, linked: false }
        uploadedImages.current.set(key, upload)
      }
      if (!upload.linked) {
        const { error } = await sb.from('vehicle_images').insert({ vehicle_id: id, storage_path: upload.path, sort: i })
        if (error) { setBusy(false); return setMsg(`Photo uploaded, but could not be linked to the vehicle: ${error.message}`) }
        upload.linked = true
      }
    }
    setBusy(false); setOpen(false); setVehicleId(''); uploadedImages.current.clear(); r.refresh()
  }
  if (!open) return <button className="btn" onClick={() => setOpen(true)}>+ Add vehicle</button>
  const I = (n: string, l: string, t = 'text', d = '') => <div><label>{l}</label><input name={n} type={t} defaultValue={d} step="any" /></div>
  return (<form className="panel" onSubmit={save}><h3>Add vehicle</h3><div className="row">{owners && <div><label>Partner (owner)</label><select name="owner_id" required>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>}{I('name', 'Name & model')}{I('brand', 'Brand')}{I('model_year', 'Year', 'number', '2023')}
    <div><label>Category</label><select name="category">{['Sedan', 'Hatchback', 'SUV', 'MPV', 'Pickup', 'Van', 'Premium', 'Commercial'].map((c) => <option key={c}>{c}</option>)}</select></div>
    <div><label>Transmission</label><select name="transmission"><option>Automatic</option><option>Manual</option></select></div>
    <div><label>Fuel</label><select name="fuel"><option>Gasoline</option><option>Diesel</option><option>Hybrid</option><option>Electric</option></select></div>
    {I('seats', 'Seats', 'number', '5')}{I('luggage', 'Luggage', 'number', '2')}{I('location', 'Location')}
    {I('self_drive_rate', 'Self Drive / day (₱)', 'number')}{I('with_driver_rate', 'With Driver / day (₱)', 'number')}{I('delivery_fee', 'Delivery fee (₱)', 'number')}{I('additional_fee', 'Additional fee (₱)', 'number')}{I('deposit', 'Refundable deposit (₱)', 'number')}{I('tax_pct', 'Tax %', 'number', '12')}
    <div><label>Prices are</label><select name="tax_mode"><option value="exc">Tax-exclusive (tax added)</option><option value="inc">Tax-inclusive</option></select></div></div>
    <label>Features (comma separated)</label><input name="features" /><label>Description</label><textarea name="description" rows={2} />
    <label>Photos</label><input name="images" type="file" accept="image/*" multiple />
    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input name="publish" type="checkbox" style={{ width: 'auto', margin: 0 }} />Submit for publishing (admin review may apply)</label>
    {msg && <small className="err">{msg}</small>}<button className="btn" disabled={busy}>{busy ? 'Saving…' : vehicleId ? 'Retry photo upload' : 'Save vehicle'}</button> <button type="button" className="btn dk" onClick={() => setOpen(false)}>Cancel</button></form>)
}
