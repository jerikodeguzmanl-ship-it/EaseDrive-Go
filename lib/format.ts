export const P = (n: number | string | null | undefined) => '₱' + Math.round(Number(n || 0)).toLocaleString('en-PH')
export const pub = (bucket: string, path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
// Postgres daterange text "[2026-11-18,2026-11-21)" -> "2026-11-18 → 2026-11-20"
export const range = (p: string) => { const m = p?.match(/(\d{4}-\d\d-\d\d),(\d{4}-\d\d-\d\d)/); if (!m) return p; const e = new Date(m[2] + 'T00:00:00Z'); if (p.endsWith(')')) e.setUTCDate(e.getUTCDate() - 1); return `${m[1]} → ${e.toISOString().slice(0, 10)}` }
export const tone = (s: string) => ({ Pending: 'o', 'Under Review': 'o', Confirmed: 'g', Approved: 'g', Completed: 'g', Published: 'g', Rejected: 'r', Cancelled: 'r', Expired: 'gr', Suspended: 'r' } as any)[s] || 'gr'
