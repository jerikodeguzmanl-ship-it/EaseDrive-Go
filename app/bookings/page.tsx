import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import Action from '@/components/Action'
import BookingLiveMap from '@/components/BookingLiveMap'
import PhoneFrame from '@/components/PhoneFrame'
import { P, range, tone } from '@/lib/format'

const GROUPS: [string, string[]][] = [['Pending', ['Pending', 'Under Review']], ['Confirmed / Upcoming', ['Approved', 'Confirmed']], ['Completed', ['Completed']], ['Cancelled / Rejected / Expired', ['Cancelled', 'Rejected', 'Expired']]]

export default async function MyBookings() {
  const sb = await supabaseServer(); const { data: { user } } = await sb.auth.getUser()
  const { data: bks } = await sb.from('bookings').select('*, vehicles(name,id), business_owners(business_name,phone,email)').eq('customer_id', user!.id).order('created_at', { ascending: false })
  return (<PhoneFrame active="bookings"><div className="customer-screen"><h1>My Bookings</h1>
    {!bks?.length && <div className="empty">No bookings yet. <Link href="/" style={{ textDecoration: 'underline' }}>Explore vehicles</Link></div>}
    {GROUPS.map(([title, sts]) => { const list = (bks ?? []).filter((b: any) => sts.includes(b.status)); if (!list.length) return null
      return (<div key={title}><h3 style={{ margin: '18px 0 8px' }}>{title}</h3>{list.map((b: any) => (<div key={b.id} className="panel">
        <b>{b.ref}</b> <span className={'pill ' + tone(b.status)}>{b.status}</span>
        <p style={{ margin: '6px 0' }}>{b.vehicles?.name} · {b.service === 'self_drive' ? 'Self Drive' : 'With Driver'} · {range(b.period)}<br />Estimated total <b>{P(b.total)}</b> · Refundable deposit {P(b.deposit)}</p>
        <small style={{ color: 'var(--m)' }}>{b.business_owners?.business_name} · {b.business_owners?.phone} · {b.business_owners?.email}</small>
        {b.reject_reason && <small className="err">Reason: {b.reject_reason}</small>}
        {['Pending', 'Under Review', 'Approved', 'Confirmed'].includes(b.status) && <div style={{ marginTop: 8 }}><Action url={`/api/bookings/${b.id}`} body={{ action: 'cancel' }} label="Cancel booking" className="btn sm dk" confirmMsg="Cancel this booking?" /></div>}
        {b.status === 'Confirmed' && <BookingLiveMap bookingId={b.id} status={b.status} side="customer" />}</div>))}</div>) })}</div></PhoneFrame>)
}
