import { call } from '@/lib/api'
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { return call('vehicle_busy', { p_vehicle: (await params).id }) }
