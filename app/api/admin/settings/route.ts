import { adminOnly, json } from '@/lib/api'
const RULES: Record<string, (v: any) => boolean> = { pending_expiry_hours: (v) => Number.isInteger(v) && v >= 1 && v <= 168, require_vehicle_review: (v) => typeof v === 'boolean' }
export async function PATCH(req: Request) {
  const a = await adminOnly(); if ('err' in a) return a.err
  const { key, value } = await req.json()
  if (!RULES[key]?.(value)) return json({ error: 'Invalid setting' }, 400)
  const { error } = await a.sb.from('platform_settings').upsert({ key, value })
  return error ? json({ error: error.message }, 400) : json({ ok: true })
}
