import { json } from '@/lib/api'
import { supabaseServer } from '@/lib/supabase/server'

const OK: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

// GET /api/ids            -> my latest ID status
// GET /api/ids?customerId -> 60s signed link (customer's own, their partner, or admin; enforced by RLS)
export async function GET(req: Request) {
  const sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ error: 'Login required' }, 401)
  const cid = new URL(req.url).searchParams.get('customerId')
  if (!cid) { const { data } = await sb.from('customer_ids').select('id,id_type,status,created_at').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(1); return json(data?.[0] ?? { none: true }) }
  const { data: row } = await sb.from('customer_ids').select('storage_path,status,id_type').eq('customer_id', cid).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!row) return json({ error: 'No ID uploaded' }, 404)
  const { data } = await sb.storage.from('ids').createSignedUrl(row.storage_path, 60)
  return json({ url: data?.signedUrl, status: row.status, id_type: row.id_type })
}
export async function POST(req: Request) {
  const f = await req.formData(), file = f.get('file') as File | null, idType = String(f.get('idType') || '').trim()
  if (!file || !OK[file.type] || file.size > 5_000_000) return json({ error: 'Upload a JPG, PNG, WEBP or PDF up to 5MB.' }, 400)
  if (!idType) return json({ error: 'Choose the ID type.' }, 400)
  const sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ error: 'Login required' }, 401)
  const path = `${user.id}/${crypto.randomUUID()}.${OK[file.type]}` // private bucket, folder = customer id
  const up = await sb.storage.from('ids').upload(path, file, { contentType: file.type })
  if (up.error) return json({ error: up.error.message }, 400)
  const { data, error } = await sb.from('customer_ids').insert({ customer_id: user.id, id_type: idType, storage_path: path }).select('id,id_type,status').single()
  if (error) { await sb.storage.from('ids').remove([path]); return json({ error: error.message }, 400) }
  return json(data, 201)
}
