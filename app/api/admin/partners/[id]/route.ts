import { adminOnly, call, json } from '@/lib/api'

// PATCH { status: 'Approved'|'Suspended' } (reactivate = Approved) | { action: 'update', business_name, phone, email, address }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, b = await req.json()
  if (b.action === 'update') {
    const a = await adminOnly(); if ('err' in a) return a.err
    if (!b.business_name?.trim()) return json({ error: 'Business name is required.' }, 400)
    const { error } = await a.sb.from('business_owners').update({ business_name: b.business_name.trim(), phone: b.phone || null, email: b.email || null, address: b.address || null }).eq('id', id)
    return error ? json({ error: error.message }, 400) : json({ ok: true })
  }
  return call('set_partner_status', { p_owner: id, p_status: b.status })
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) { return call('admin_delete_partner', { p_owner: (await params).id }) }
