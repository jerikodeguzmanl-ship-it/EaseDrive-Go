import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import Action from '@/components/Action'
import AddVehicleForm from '@/components/AddVehicleForm'
import BlockForm from '@/components/BlockForm'
import IdReview from '@/components/IdReview'
import BookingLiveMap from '@/components/BookingLiveMap'
import { P, range, tone } from '@/lib/format'

export default async function Partner() {
  const sb = await supabaseServer(); const { data: { user } } = await sb.auth.getUser()
  const { data: me } = await sb.from('business_owners').select('id,business_name').eq('profile_id', user!.id).eq('status', 'Approved').maybeSingle()
  if (!me) return <div className="wrap"><div className="panel narrow"><h2>Partner account not active</h2><p style={{ margin: '8px 0 14px', color: 'var(--m)' }}>Your partner dashboard is available after your application is approved.</p><Link href="/apply" className="btn">Check your application</Link></div></div>
  const { data: vs } = await sb.from('vehicles').select('*, vehicle_rates(*)').eq('owner_id', me.id).neq('status', 'Archived').order('created_at', { ascending: false })
  const { data: bs } = await sb.from('bookings').select('*, vehicles(name), profiles(full_name,phone)').eq('owner_id', me.id).order('created_at', { ascending: false })
  const cids = [...new Set((bs ?? []).map((b: any) => b.customer_id))]
  const { data: ids } = cids.length ? await sb.from('customer_ids').select('id,customer_id,status,id_type,created_at').in('customer_id', cids).order('created_at', { ascending: false }) : { data: [] as any[] }
  const idOf = (c: string) => (ids ?? []).find((i: any) => i.customer_id === c)
  const n = (s: string[]) => (bs ?? []).filter((b: any) => s.includes(b.status)).length
  const revenue = (bs ?? []).filter((b: any) => b.status === 'Completed').reduce((s: number, b: any) => s + Number(b.total), 0)
  const monthlyBookings = Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - (5 - index))
    const count = (bs ?? []).filter((booking: any) => {
      const created = new Date(booking.created_at)
      return created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth()
    }).length
    return { label: date.toLocaleString('en-US', { month: 'short' }), count }
  })
  const maxMonthlyBookings = Math.max(1, ...monthlyBookings.map((month) => month.count))
  return (<div className="dash">
    <aside className="side"><div className="dashboard-nav-title">PARTNER MENU</div><a className="on" href="#overview">Overview</a><a href="#bookings">Bookings</a><a href="#vehicles">My vehicles</a><a href="#availability">Availability</a></aside>
    <div className="main">
      <section id="overview" className="dashboard-section"><div className="dashboard-heading"><div><h1>{me.business_name}</h1><p>Manage your rental business and customer bookings.</p></div><span className="pill g">Verified partner</span></div>
    <div className="stats"><div className="st hi"><span className="stat-label">Completed revenue</span><b>{P(revenue)}</b></div><div className="st"><span className="stat-label">Vehicles</span><b>{vs?.length ?? 0}</b></div><div className="st"><span className="stat-label">Published</span><b>{(vs ?? []).filter((v: any) => v.status === 'Published').length}</b></div><div className="st"><span className="stat-label">Pending requests</span><b>{n(['Pending', 'Under Review'])}</b></div><div className="st"><span className="stat-label">Confirmed</span><b>{n(['Approved', 'Confirmed'])}</b></div><div className="st"><span className="stat-label">Completed</span><b>{n(['Completed'])}</b></div><div className="st"><span className="stat-label">Cancelled</span><b>{n(['Cancelled', 'Rejected', 'Expired'])}</b></div></div>
    <div className="panel chart-panel"><div className="chart-heading"><div><h3>Booking activity</h3><p>Reservations created in the last six months.</p></div></div><div className="bar-chart" role="img" aria-label="Monthly booking counts">{monthlyBookings.map((month) => <div className="bar-column" key={month.label}><span className="bar-value">{month.count}</span><div className="bar-track"><i style={{ height: `${Math.max(4, month.count / maxMonthlyBookings * 100)}%` }} /></div><small>{month.label}</small></div>)}</div></div></section>
    <section id="bookings" className="dashboard-section"><div className="section-heading"><div><h2>Booking requests</h2><p>Review and manage customer reservations.</p></div></div><div className="panel">{!bs?.length ? <div className="empty">No bookings yet.</div> : <div className="tw"><table className="t"><thead><tr><th>Ref</th><th>Customer</th><th>Vehicle / dates</th><th>Details</th><th>Est. total</th><th>Status</th><th></th></tr></thead><tbody>{bs.map((b: any) => <tr key={b.id}>
      <td>{b.ref}</td><td>{b.profiles?.full_name}<br /><small>{b.profiles?.phone}</small><div style={{ marginTop: 6 }}><IdReview customerId={b.customer_id} row={idOf(b.customer_id)} /></div></td><td>{b.vehicles?.name}<br /><small>{b.service === 'self_drive' ? 'Self Drive' : 'With Driver'} · {range(b.period)}</small></td>
      <td><small>{b.delivery ? 'Delivery' : 'Pickup'}: {b.address}<br />{b.passengers} pax · {b.pickup_time}<br />Base {P(b.base)} + fees {P(Number(b.delivery_fee) + Number(b.extra_fee))} − disc {P(b.discount)} + tax {P(b.tax)}{b.notes && <><br />“{b.notes}”</>}</small></td>
      <td>{P(b.total)}</td><td><span className={'pill ' + tone(b.status)}>{b.status}</span></td>
      <td>{['Pending', 'Under Review'].includes(b.status) && <><Action url={`/api/bookings/${b.id}`} body={{ action: 'approve' }} label="Approve" /><Action url={`/api/bookings/${b.id}`} body={{ action: 'reject' }} ask="Reason for rejection?" label="Reject" className="btn sm dk" /></>}
        {b.status === 'Confirmed' && <><BookingLiveMap bookingId={b.id} status={b.status} side="owner" /><Action url={`/api/bookings/${b.id}`} body={{ action: 'complete' }} label="Mark completed" confirmMsg="Mark this rental as completed?" /></>}</td></tr>)}</tbody></table></div>}</div></section>
    <section id="vehicles" className="dashboard-section"><div className="section-heading"><div><h2>My vehicles</h2><p>Add listings and update their availability.</p></div></div><div className="panel"><AddVehicleForm />{!vs?.length ? <div className="empty">No vehicles yet.</div> : <div className="tw"><table className="t"><thead><tr><th>Vehicle</th><th>Rates / day</th><th>Status</th><th></th></tr></thead><tbody>{vs.map((v: any) => <tr key={v.id}><td>{v.name}<br /><small>{v.model_year} · {v.category}</small></td><td><small>Self Drive {P(v.vehicle_rates?.self_drive_rate)}<br />With Driver {P(v.vehicle_rates?.with_driver_rate)}</small></td><td><span className={'pill ' + tone(v.status)}>{v.status}</span></td>
      <td>{v.status === 'Published' ? <Action url={`/api/vehicles/${v.id}`} body={{ status: 'Unavailable' }} label="Unpublish" className="btn sm dk" /> : <Action url={`/api/vehicles/${v.id}`} body={{ status: 'Published' }} label="Publish" />}<Action url={`/api/vehicles/${v.id}`} method="DELETE" label="Archive" className="btn sm dk" confirmMsg="Archive this vehicle?" /></td></tr>)}</tbody></table></div>}</div></section>
    {!!vs?.length && <section id="availability" className="dashboard-section"><div className="section-heading"><div><h2>Availability</h2><p>Block dates when a vehicle cannot be booked.</p></div></div><BlockForm vehicles={vs.map((v: any) => ({ id: v.id, name: v.name }))} /></section>}
    </div></div>)
}
