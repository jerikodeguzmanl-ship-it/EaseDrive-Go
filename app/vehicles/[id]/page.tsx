import { notFound } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import BookingPanel from '@/components/BookingPanel'
import PhoneFrame from '@/components/PhoneFrame'
import { pub } from '@/lib/format'

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await supabaseServer()
  const { data: v } = await sb.from('vehicles').select('*, vehicle_images(storage_path,sort), business_owners(business_name,phone,email,address), reviews(rating,comment)').eq('id', id).eq('status', 'Published').single()
  if (!v) notFound()
  const imgs = [...(v.vehicle_images ?? [])].sort((a: any, b: any) => a.sort - b.sort)
  const rs = v.reviews ?? [], avg = rs.length ? (rs.reduce((s: number, r: any) => s + r.rating, 0) / rs.length).toFixed(1) : null
  return (<PhoneFrame active="explore"><div className="customer-screen"><div className="two"><div>
    <div style={{ display: 'flex', overflowX: 'auto', gap: 8, scrollSnapType: 'x mandatory' }}>{imgs.length ? imgs.map((i: any) => <img key={i.storage_path} src={pub('vehicles', i.storage_path)} alt="" style={{ width: '100%', borderRadius: 20, scrollSnapAlign: 'start', flex: '0 0 100%', maxHeight: 360, objectFit: 'cover' }} />) : <div className="ph" style={{ borderRadius: 20, height: 280 }}>No photo</div>}</div>
    <h1 style={{ margin: '14px 0 4px' }}>{v.name}</h1><p style={{ color: 'var(--m)' }}>{v.model_year} {v.category} · {v.location}{avg && ` · ★ ${avg} (${rs.length})`}</p>
    <p style={{ margin: '10px 0' }}>{v.description}</p>
    <div className="meta"><span>{v.transmission}</span><span>{v.fuel}</span><span>{v.seats} passengers</span>{v.luggage != null && <span>{v.luggage} luggage</span>}{v.aircon && <span>Air-conditioned</span>}{(v.features ?? []).map((f: string) => <span key={f}>{f}</span>)}</div>
    <div className="panel" style={{ background: 'var(--c)', color: '#fff' }}><b>{v.business_owners?.business_name}</b><br /><small>{v.business_owners?.address}<br />{v.business_owners?.phone} · {v.business_owners?.email}</small></div>
  </div><BookingPanel vehicleId={v.id} seats={v.seats} partner={v.business_owners} /></div></div></PhoneFrame>)
}
