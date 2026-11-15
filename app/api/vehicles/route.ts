import { call, json } from '@/lib/api'
import { supabaseServer } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const cat = new URL(req.url).searchParams.get('category')
  const sb = await supabaseServer()
  let q = sb.from('vehicles').select('*, vehicle_rates(*), vehicle_images(storage_path,sort), business_owners(business_name,phone,email,address)').eq('status', 'Published')
  if (cat && cat !== 'All') q = q.eq('category', cat)
  const { data, error } = await q.order('created_at', { ascending: false })
  return error ? json({ error: error.message }, 400) : json(data)
}
export async function POST(req: Request) { return call('create_vehicle', { p: await req.json() }) }
