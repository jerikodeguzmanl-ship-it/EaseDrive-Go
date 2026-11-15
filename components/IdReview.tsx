'use client'
import Action from './Action'
// Shows a customer's valid-ID status with View / Verify / Reject (partner for their own customers, admin for all)
export default function IdReview({ customerId, row }: { customerId: string; row?: { id: string; status: string; id_type: string } | null }) {
  if (!row) return <span className="pill r">No ID uploaded</span>
  return (<div><span className={'pill ' + (row.status === 'Verified' ? 'g' : row.status === 'Rejected' ? 'r' : 'o')}>ID {row.status}</span> <small>{row.id_type}</small><br />
    <button className="btn sm dk" onClick={async () => { const r = await fetch('/api/ids?customerId=' + customerId), j = await r.json().catch(() => ({})); j.url ? window.open(j.url, '_blank') : alert(j.error || 'Cannot open ID') }}>View ID</button>
    {row.status !== 'Verified' && <Action url={`/api/ids/${row.id}`} body={{ ok: true }} label="Verify ID" />}
    {row.status !== 'Rejected' && <Action url={`/api/ids/${row.id}`} body={{ ok: false }} label="Reject ID" className="btn sm dk" confirmMsg="Reject this ID? The customer must upload a new one." />}</div>)
}
