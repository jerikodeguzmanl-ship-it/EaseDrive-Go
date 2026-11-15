import { json } from '@/lib/api'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const b = await req.json(), sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ error: 'Login required' }, 401)
  if (!b.business_name || !b.owner_name || !/^\S+@\S+\.\S+$/.test(b.email ?? '')) return json({ error: 'Missing or invalid fields' }, 400)
  const { data, error } = await sb.from('partner_applications').insert({ applicant_id: user.id, business_name: b.business_name, owner_name: b.owner_name, email: b.email, phone: b.phone, address: b.address, description: b.description, vehicle_count: Number(b.vehicle_count) || null }).select().single()
  return error ? json({ error: error.message }, 400) : json(data, 201)
}
export async function GET() { // applicant sees own; admin sees all (RLS)
  const sb = await supabaseServer()
  const { data, error } = await sb.from('partner_applications').select('*, business_documents(id,kind,verified)').order('created_at', { ascending: false })
  return error ? json({ error: error.message }, 400) : json(data)
}
