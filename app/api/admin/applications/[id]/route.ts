import { adminOnly, call, json } from '@/lib/api'

// Admin only. PATCH { verifyDocument?: id, contractSigned?: true, status?: '...', notes? } | DELETE (not for approved applications)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await adminOnly(); if ('err' in a) return a.err
  const { id } = await params, b = await req.json(), sb = a.sb
  if (b.verifyDocument) { const { error } = await sb.from('business_documents').update({ verified: true }).eq('id', b.verifyDocument); if (error) return json({ error: error.message }, 400) }
  if (b.contractSigned) { const { error } = await sb.from('partnership_contracts').insert({ application_id: id, signed_at: new Date().toISOString() }); if (error) return json({ error: error.message }, 400) }
  if (b.status) return call('set_application_status', { p_app: id, p_status: b.status, p_notes: b.notes ?? null })
  return json({ ok: true })
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await adminOnly(); if ('err' in a) return a.err
  const { id } = await params
  const { data: ap } = await a.sb.from('partner_applications').select('status').eq('id', id).single()
  if (!ap) return json({ error: 'Not found' }, 404)
  if (ap.status === 'Approved') return json({ error: 'Approved applications cannot be deleted. Suspend or delete the partner instead.' }, 400)
  await a.sb.from('partnership_contracts').delete().eq('application_id', id)
  const { error } = await a.sb.from('partner_applications').delete().eq('id', id)
  return error ? json({ error: error.message }, 400) : json({ ok: true })
}
