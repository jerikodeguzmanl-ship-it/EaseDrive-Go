import { call } from '@/lib/api'
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const b = await req.json()
  return call('block_dates', { p_vehicle: (await params).id, p_start: b.start, p_end: b.end, p_reason: b.reason === 'Maintenance' ? 'Maintenance' : 'Unavailable' })
}
