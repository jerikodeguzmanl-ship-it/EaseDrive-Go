import { json } from '@/lib/api'
import { supabaseServer } from '@/lib/supabase/server'

const OK: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }

export async function POST(req: Request) {
  const f = await req.formData(), file = f.get('file') as File | null
  const appId = String(f.get('applicationId') || ''), kind = String(f.get('kind') || 'permit')
  if (!file || !OK[file.type] || file.size > 5_000_000) return json({ error: 'PDF/JPG/PNG up to 5MB only' }, 400)
  const sb = await supabaseServer(), { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ error: 'Login required' }, 401)
  const path = `${user.id}/${appId}/${crypto.randomUUID()}.${OK[file.type]}` // private bucket, folder = uploader id
  const up = await sb.storage.from('documents').upload(path, file, { contentType: file.type })
  if (up.error) return json({ error: up.error.message }, 400)
  const { error } = await sb.from('business_documents').insert({ application_id: appId, kind, storage_path: path })
  if (error) { await sb.storage.from('documents').remove([path]); return json({ error: error.message }, 400) }
  return json({ ok: true }, 201)
}
export async function GET(req: Request) { // 60-second signed link, only for the uploader or admin
  const id = new URL(req.url).searchParams.get('id')!, sb = await supabaseServer()
  const { data: d } = await sb.from('business_documents').select('storage_path').eq('id', id).single()
  if (!d) return json({ error: 'Not found' }, 404)
  const { data } = await sb.storage.from('documents').createSignedUrl(d.storage_path, 60)
  return json({ url: data?.signedUrl })
}
