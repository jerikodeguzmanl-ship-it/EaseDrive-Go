import { supabaseServer } from '@/lib/supabase/server'
import Action from '@/components/Action'
import DocLink from '@/components/DocLink'
import IdReview from '@/components/IdReview'
import HeroManager from '@/components/HeroManager'
import AdminCreateUser from '@/components/AdminCreateUser'
import SettingsPanel from '@/components/SettingsPanel'
import EditPartner from '@/components/EditPartner'
import AddVehicleForm from '@/components/AddVehicleForm'
import { AdminBookingLocationControl } from '@/components/BookingLiveMap'
import { P, range, tone } from '@/lib/format'

export default async function Admin() {
  const sb = await supabaseServer()
  const cnt = async (t: string, f?: (q: any) => any) => { let q: any = sb.from(t).select('*', { count: 'exact', head: true }); if (f) q = f(q); return (await q).count ?? 0 }
  const [customersN, partnersN, pendingApps, vehiclesN, bookings, pendingBk, confirmed, completed, cancelledBk] = await Promise.all([
    cnt('profiles', (q) => q.eq('role', 'customer')), cnt('business_owners', (q) => q.eq('status', 'Approved')), cnt('partner_applications', (q) => q.not('status', 'in', '("Approved","Rejected")')),
    cnt('vehicles'), cnt('bookings'), cnt('bookings', (q) => q.in('status', ['Pending', 'Under Review'])), cnt('bookings', (q) => q.in('status', ['Approved', 'Confirmed'])), cnt('bookings', (q) => q.eq('status', 'Completed')), cnt('bookings', (q) => q.in('status', ['Cancelled', 'Rejected', 'Expired']))])
  const [{ data: apps }, { data: owners }, { data: customers }, { data: vehicles }, { data: bks }, { data: ids }, { data: hero }, { data: settings }, { data: logs }] = await Promise.all([
    sb.from('partner_applications').select('*, business_documents(id,kind,verified)').order('created_at', { ascending: false }),
    sb.from('business_owners').select('*').order('created_at', { ascending: false }),
    sb.from('profiles').select('id,full_name,phone,email,suspended,created_at').eq('role', 'customer').order('created_at', { ascending: false }),
    sb.from('vehicles').select('id,name,status,model_year,category,business_owners(business_name),vehicle_rates(self_drive_rate,with_driver_rate)').order('created_at', { ascending: false }),
    sb.from('bookings').select('*, vehicles(name), business_owners(business_name), profiles(full_name,phone)').order('created_at', { ascending: false }).limit(100),
    sb.from('customer_ids').select('id,customer_id,status,id_type,created_at').order('created_at', { ascending: false }),
    sb.from('hero_images').select('id,storage_path,sort').order('sort'),
    sb.from('platform_settings').select('*'),
    sb.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(20)])
  const st: Record<string, any> = Object.fromEntries((settings ?? []).map((s: any) => [s.key, s.value]))
  const idOf = (c: string) => (ids ?? []).find((i: any) => i.customer_id === c)
  const bkCount = (c: string) => (bks ?? []).filter((b: any) => b.customer_id === c).length
  const approvedOwners = (owners ?? []).filter((o: any) => o.status === 'Approved').map((o: any) => ({ id: o.id, name: o.business_name }))
  const S = ['Under Review', 'Documents Required', 'Awaiting Agreement', 'Approved', 'Rejected']
  const H = (id: string, t: string, d: string, extra?: React.ReactNode) => <div className="section-heading"><div><h2>{t}</h2><p>{d}</p></div>{extra}</div>
  return (<div className="dash">
    <aside className="side"><div className="dashboard-nav-title">ADMIN MENU</div><a className="on" href="#overview">Overview</a><a href="#customers">Customers</a><a href="#partners">Partners</a><a href="#applications">Applications</a><a href="#vehicles">Vehicles</a><a href="#bookings">Bookings</a><a href="#homepage">Front page images</a><a href="#settings">Settings</a><a href="#activity">Activity log</a></aside>
    <div className="main">
      <section id="overview" className="dashboard-section"><div className="dashboard-heading"><div><h1>Founder Dashboard</h1><p>Full control of customers, partners, vehicles, bookings and the front page.</p></div><span className="pill bl">Administrator</span></div>
        <div className="stats">{[['Customers', customersN], ['Approved partners', partnersN], ['Open applications', pendingApps], ['Vehicles', vehiclesN], ['Bookings', bookings], ['Pending', pendingBk], ['Confirmed', confirmed], ['Completed', completed]].map(([l, v]) => <div key={l as string} className="st"><span className="stat-label">{l}</span><b>{v}</b></div>)}</div>
        <div className="panel chart-panel"><div className="chart-heading"><div><h3>Booking status</h3><p>Current reservation totals by status.</p></div></div><div className="status-bars">{[['Pending', pendingBk], ['Confirmed', confirmed], ['Completed', completed], ['Cancelled', cancelledBk]].map(([label, count]) => <div className="status-bar-row" key={label as string}><span>{label}</span><div className="status-track"><i style={{ width: `${bookings ? Number(count) / bookings * 100 : 0}%` }} /></div><b>{count}</b></div>)}</div></div></section>

      <section id="customers" className="dashboard-section">{H('c', 'Customers', 'View, suspend, set a temporary password, or delete customer accounts.', <AdminCreateUser role="customer" />)}
        <div className="panel">{!customers?.length ? <div className="empty">No customers yet.</div> : <div className="tw"><table className="t"><thead><tr><th>Customer</th><th>Valid ID</th><th>Bookings</th><th>Status</th><th></th></tr></thead><tbody>{customers.map((c: any) => <tr key={c.id}>
          <td><b>{c.full_name || '(no name)'}</b><br /><small>{c.email} {c.phone && `· ${c.phone}`}</small></td><td><IdReview customerId={c.id} row={idOf(c.id)} /></td><td>{bkCount(c.id)}</td><td><span className={'pill ' + (c.suspended ? 'r' : 'g')}>{c.suspended ? 'Suspended' : 'Active'}</span></td>
          <td>{c.suspended ? <Action url={`/api/admin/users/${c.id}`} body={{ suspended: false }} label="Reactivate" /> : <Action url={`/api/admin/users/${c.id}`} body={{ suspended: true }} label="Suspend" className="btn sm dk" confirmMsg="Suspend this customer? They cannot make new bookings." />}
            <Action url={`/api/admin/users/${c.id}`} body={{ action: 'set_password' }} ask="Enter a new temporary password (8+ characters):" label="Set password" className="btn sm dk" />
            <Action url={`/api/admin/users/${c.id}`} method="DELETE" label="Delete" className="btn sm dk" confirmMsg="Delete this customer permanently? This cannot be undone." /></td></tr>)}</tbody></table></div>}</div></section>

      <section id="partners" className="dashboard-section">{H('p', 'Partners', 'Add, edit, suspend, reactivate (restore access), set a temporary password, or delete rental businesses.', <AdminCreateUser role="owner" />)}
        <div className="panel">{!owners?.length ? <div className="empty">No partners registered.</div> : owners.map((o: any) => <div key={o.id} style={{ borderTop: '1px solid var(--b)', padding: '10px 0' }}>
          <b>{o.business_name}</b> <span className={'pill ' + tone(o.status)}>{o.status}</span><br /><small>{o.email} · {o.phone} · {o.address}</small><EditPartner o={o} />
          <div>{o.status === 'Approved' ? <Action url={`/api/admin/partners/${o.id}`} body={{ status: 'Suspended' }} label="Suspend" className="btn sm dk" confirmMsg="Suspend this partner? Their listings go offline." /> : <Action url={`/api/admin/partners/${o.id}`} body={{ status: 'Approved' }} label="Reactivate account" />}
            <Action url={`/api/admin/users/${o.profile_id}`} body={{ action: 'set_password' }} ask="Enter a new temporary password for this partner (8+ characters):" label="Set password" className="btn sm dk" />
            <Action url={`/api/admin/partners/${o.id}`} method="DELETE" label="Delete" className="btn sm dk" confirmMsg="Delete this partner and all their vehicles? This cannot be undone. Partners with bookings cannot be deleted." /></div></div>)}</div></section>

      <section id="applications" className="dashboard-section">{H('a', 'Partner applications', 'Business permits are optional; a signed agreement is required for approval.', <span className="pill o">{pendingApps} open</span>)}
        <div className="panel">{!apps?.length ? <div className="empty">No applications.</div> : apps.map((a: any) => <div key={a.id} style={{ borderTop: '1px solid var(--b)', padding: '10px 0' }}>
          <b>{a.business_name}</b> <span className={'pill ' + tone(a.status)}>{a.status}</span><br /><small>{a.owner_name} · {a.email} · {a.phone} · {a.address} · {a.vehicle_count} vehicles</small>
          <div style={{ margin: '6px 0' }}>{a.business_documents?.length ? a.business_documents.map((d: any) => <span key={d.id}><DocLink id={d.id} label={`${d.kind} ${d.verified ? '✓' : ''}`} />{!d.verified && <Action url={`/api/admin/applications/${a.id}`} body={{ verifyDocument: d.id }} label="Verify" />}</span>) : <small style={{ color: 'var(--m)' }}>No document uploaded (optional).</small>}
            <Action url={`/api/admin/applications/${a.id}`} body={{ contractSigned: true }} label="Record signed contract" className="btn sm dk" /></div>
          <div>{S.filter((s) => s !== a.status).map((s) => <Action key={s} url={`/api/admin/applications/${a.id}`} body={{ status: s }} label={s} className={s === 'Rejected' ? 'btn sm dk' : 'btn sm'} />)}
            {a.status !== 'Approved' && <Action url={`/api/admin/applications/${a.id}`} method="DELETE" label="Delete" className="btn sm dk" confirmMsg="Delete this application?" />}</div></div>)}</div></section>

      <section id="vehicles" className="dashboard-section">{H('v', 'Vehicles', 'Add vehicles for any partner, approve listings, publish, archive or delete.')}
        <div className="panel"><AddVehicleForm owners={approvedOwners} />{!vehicles?.length ? <div className="empty">No vehicles yet.</div> : <div className="tw"><table className="t"><thead><tr><th>Vehicle</th><th>Partner</th><th>Rates / day</th><th>Status</th><th></th></tr></thead><tbody>{vehicles.map((v: any) => { const r = Array.isArray(v.vehicle_rates) ? v.vehicle_rates[0] : v.vehicle_rates
          return <tr key={v.id}><td>{v.name}<br /><small>{v.model_year} · {v.category}</small></td><td>{v.business_owners?.business_name}</td><td><small>SD {P(r?.self_drive_rate)}<br />WD {P(r?.with_driver_rate)}</small></td><td><span className={'pill ' + tone(v.status)}>{v.status}</span></td>
            <td>{v.status === 'Pending Review' && <><Action url={`/api/admin/vehicles/${v.id}`} body={{ approve: true }} label="Approve" /><Action url={`/api/admin/vehicles/${v.id}`} body={{ approve: false }} label="Reject" className="btn sm dk" /></>}
              {v.status === 'Published' ? <Action url={`/api/vehicles/${v.id}`} body={{ status: 'Unavailable' }} label="Unpublish" className="btn sm dk" /> : v.status !== 'Pending Review' && v.status !== 'Archived' && <Action url={`/api/vehicles/${v.id}`} body={{ status: 'Published' }} label="Publish" />}
              {v.status !== 'Archived' && <Action url={`/api/vehicles/${v.id}`} body={{ status: 'Archived' }} label="Archive" className="btn sm dk" confirmMsg="Archive this vehicle?" />}
              <Action url={`/api/admin/vehicles/${v.id}`} method="DELETE" label="Delete" className="btn sm dk" confirmMsg="Delete this vehicle permanently? Vehicles with bookings must be archived instead." /></td></tr> })}</tbody></table></div>}</div></section>

      <section id="bookings" className="dashboard-section">{H('b', 'Bookings', 'Approve or reject any booking (a customer valid ID is required), cancel, complete or delete.')}
        <div className="panel">{!bks?.length ? <div className="empty">No bookings yet.</div> : <div className="tw"><table className="t"><thead><tr><th>Ref</th><th>Customer / ID</th><th>Vehicle / partner</th><th>Dates</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>{bks.map((b: any) => <tr key={b.id}>
          <td>{b.ref}</td><td>{b.profiles?.full_name}<br /><small>{b.profiles?.phone}</small><div style={{ marginTop: 6 }}><IdReview customerId={b.customer_id} row={idOf(b.customer_id)} /></div></td><td>{b.vehicles?.name}<br /><small>{b.business_owners?.business_name}</small></td><td><small>{b.service === 'self_drive' ? 'Self Drive' : 'With Driver'}<br />{range(b.period)}</small></td><td>{P(b.total)}</td><td><span className={'pill ' + tone(b.status)}>{b.status}</span></td>
          <td>{['Pending', 'Under Review'].includes(b.status) && <><Action url={`/api/bookings/${b.id}`} body={{ action: 'approve' }} label="Approve" /><Action url={`/api/bookings/${b.id}`} body={{ action: 'reject' }} ask="Reason for rejection?" label="Reject" className="btn sm dk" /></>}
            {b.status === 'Confirmed' && <><AdminBookingLocationControl bookingId={b.id} status={b.status} /><Action url={`/api/bookings/${b.id}`} body={{ action: 'complete' }} label="Complete" confirmMsg="Mark as completed?" /></>}
            {['Pending', 'Under Review', 'Approved', 'Confirmed'].includes(b.status) && <Action url={`/api/bookings/${b.id}`} body={{ action: 'cancel' }} label="Cancel" className="btn sm dk" confirmMsg="Cancel this booking?" />}
            {['Cancelled', 'Rejected', 'Expired', 'Completed'].includes(b.status) && <Action url={`/api/admin/bookings/${b.id}`} method="DELETE" label="Delete" className="btn sm dk" confirmMsg="Delete this booking record permanently?" />}</td></tr>)}</tbody></table></div>}</div></section>

      <section id="homepage" className="dashboard-section">{H('h', 'Front page images', 'These slides appear on the welcome screen of the app.')}<HeroManager images={(hero ?? []) as any} /></section>
      <section id="settings" className="dashboard-section">{H('s', 'Settings', 'Booking and listing rules.')}<SettingsPanel expiry={Number(st.pending_expiry_hours ?? 24)} review={st.require_vehicle_review !== false} /></section>
      <section id="activity" className="dashboard-section">{H('l', 'Activity log', 'Recent administrative and platform events.')}<div className="panel">{logs?.length ? logs.map((l: any) => <div key={l.id} className="activity-row"><small>{new Date(l.created_at).toLocaleString()} · {l.action} · {l.entity} {String(l.entity_id).slice(0, 8)}</small></div>) : <div className="empty">No recent activity.</div>}</div></section>
    </div></div>)
}
