import { adminOnly, json } from '@/lib/api'
import { serviceClient } from '@/lib/supabase/admin'

// Admin creates a customer or an approved partner account directly.
export async function POST(req: Request) {
  const a = await adminOnly(); if ('err' in a) return a.err
  const b = await req.json()
  if (!b.full_name?.trim() || !/^\S+@\S+\.\S+$/.test(b.email || '') || (b.password || '').length < 8) return json({ error: 'Full name, valid email and a password of 8+ characters are required.' }, 400)
  if (b.role === 'owner' && !b.business_name?.trim()) return json({ error: 'Business name is required for a partner.' }, 400)
  let svc; try { svc = serviceClient() } catch (e: any) { return json({ error: e.message }, 500) }
  const { data, error } = await svc.auth.admin.createUser({ email: b.email.trim(), password: b.password, email_confirm: true, user_metadata: { full_name: b.full_name.trim() } })
  if (error) return json({ error: error.message }, 400)
  const uid = data.user.id
  await svc.from('profiles').upsert({ id: uid, full_name: b.full_name.trim(), email: b.email.trim(), phone: b.phone || null, role: b.role === 'owner' ? 'owner' : 'customer' })
  if (b.role === 'owner') { const { error: e2 } = await svc.from('business_owners').insert({ profile_id: uid, business_name: b.business_name.trim(), phone: b.phone || null, email: b.email.trim(), address: b.address || null, status: 'Approved' }); if (e2) return json({ error: e2.message }, 400) }
  await svc.from('activity_logs').insert({ actor_id: a.user.id, action: b.role === 'owner' ? 'partner_created' : 'customer_created', entity: 'profile', entity_id: uid })
  return json({ ok: true, id: uid }, 201)
}
