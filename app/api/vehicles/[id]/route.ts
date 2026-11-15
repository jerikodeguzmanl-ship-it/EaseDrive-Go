import { json } from '@/lib/api'
import { supabaseServer } from '@/lib/supabase/server'

const V = ['name','brand','model_year','category','transmission','fuel','seats','luggage','aircon','description','location','features','status']
const R = ['self_drive_rate','with_driver_rate','delivery_fee','additional_fee','tax_rate','tax_inclusive','deposit','long_stay_days','long_stay_discount_pct']
const pick = (o: any, k: string[]) => Object.fromEntries(k.filter((x) => x in o).map((x) => [x, o[x]]))

// RLS guarantees owners can only touch their own vehicles; a DB trigger forces admin review before publishing.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, b = await req.json(), sb = await supabaseServer()
  const v = pick(b, V), r = pick(b, R)
  if (v.status && !['Draft','Published','Unavailable','Archived'].includes(v.status as string)) return json({ error: 'Invalid status' }, 400)
  if (Object.keys(v).length) { const { error } = await sb.from('vehicles').update(v).eq('id', id); if (error) return json({ error: error.message }, 400) }
  if (Object.keys(r).length) { const { error } = await sb.from('vehicle_rates').update(r).eq('vehicle_id', id); if (error) return json({ error: error.message }, 400) }
  return json({ ok: true })
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, sb = await supabaseServer()
  const { error } = await sb.from('vehicles').update({ status: 'Archived' }).eq('id', id) // archive, never hard delete
  return error ? json({ error: error.message }, 400) : json({ ok: true })
}
