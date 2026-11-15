import { call } from '@/lib/api'
// Verify or reject a customer ID (admin, or the partner the customer booked with)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) { return call('review_id', { p_id: (await params).id, p_ok: !!(await req.json()).ok }) }
