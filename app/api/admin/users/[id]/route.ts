import { adminOnly, call, json } from '@/lib/api'
import { serviceClient } from '@/lib/supabase/admin'

// PATCH { suspended: boolean } | { action: 'set_password', reason: '<new temporary password>' }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, b = await req.json()
  if (b.action === 'set_password') {
    const a = await adminOnly(); if ('err' in a) return a.err
    if ((b.reason || '').length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400)
    try { const { error } = await serviceClient().auth.admin.updateUserById(id, { password: b.reason }); if (error) return json({ error: error.message }, 400) } catch (e: any) { return json({ error: e.message }, 500) }
    await a.sb.from('activity_logs').insert({ actor_id: a.user.id, action: 'password_set', entity: 'profile', entity_id: id })
    return json({ ok: true })
  }
  return call('admin_suspend_user', { p_user: id, p_flag: !!b.suspended })
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) { return call('admin_delete_user', { p_user: (await params).id }) }
