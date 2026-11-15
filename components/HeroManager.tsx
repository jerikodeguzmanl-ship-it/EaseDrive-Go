'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { pub } from '@/lib/format'

type Img = { id: string; storage_path: string; sort: number }
// Admin: upload, reorder and remove the front-page (welcome) images
export default function HeroManager({ images }: { images: Img[] }) {
  const r = useRouter(), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false)
  async function add(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []); e.target.value = ''; if (!files.length) return
    setBusy(true); setMsg(''); const sb = supabaseBrowser(); let sort = images.reduce((m, i) => Math.max(m, i.sort), -1) + 1
    for (const f of files) {
      if (!f.type.startsWith('image/') || f.size > 8_000_000) { setMsg(`${f.name}: use an image under 8MB.`); continue }
      const path = `${crypto.randomUUID()}.${f.name.split('.').pop()}`, up = await sb.storage.from('hero').upload(path, f, { contentType: f.type })
      if (up.error) { setMsg(up.error.message); continue }
      const { error } = await sb.from('hero_images').insert({ storage_path: path, sort: sort++ }); if (error) setMsg(error.message)
    }
    setBusy(false); r.refresh()
  }
  async function move(i: number, d: number) {
    const j = i + d; if (j < 0 || j >= images.length) return
    const sb = supabaseBrowser(); await sb.from('hero_images').update({ sort: images[j].sort }).eq('id', images[i].id); await sb.from('hero_images').update({ sort: images[i].sort }).eq('id', images[j].id); r.refresh()
  }
  async function remove(img: Img) {
    if (!confirm('Remove this image from the front page?')) return
    const sb = supabaseBrowser(); await sb.storage.from('hero').remove([img.storage_path]); const { error } = await sb.from('hero_images').delete().eq('id', img.id); error ? setMsg(error.message) : r.refresh()
  }
  return (<div className="panel"><h3>Front page images</h3>
    {!images.length && <div className="empty">No images yet. The sample slides are shown until you upload.</div>}
    {images.map((img, i) => (<div className="hero-list-row" key={img.id}><div className="hero-thumb" style={{ backgroundImage: `url(${pub('hero', img.storage_path)})` }} /><span style={{ flex: 1 }}>Slide {i + 1}</span>
      <button className="btn sm dk" disabled={i === 0} onClick={() => move(i, -1)}>↑</button><button className="btn sm dk" disabled={i === images.length - 1} onClick={() => move(i, 1)}>↓</button><button className="btn sm" onClick={() => remove(img)}>Remove</button></div>))}
    <label style={{ display: 'block', marginTop: 12 }}>Add images (JPG/PNG/WEBP, max 8MB each)</label><input type="file" accept="image/*" multiple disabled={busy} onChange={add} />
    {busy && <small>Uploading…</small>}{msg && <small className="err">{msg}</small>}</div>)
}
