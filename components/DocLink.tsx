'use client'
export default function DocLink({ id, label }: { id: string; label: string }) {
  return <button className="btn sm dk" onClick={async () => { const r = await fetch('/api/documents?id=' + id); const j = await r.json(); j.url ? window.open(j.url, '_blank') : alert(j.error) }}>{label}</button>
}
