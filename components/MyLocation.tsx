'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function MyLocation({ initialLocation, editable }: { initialLocation: string; editable: boolean }) {
  const router = useRouter()
  const [location, setLocation] = useState(initialLocation)
  const [draft, setDraft] = useState(initialLocation)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function save() {
    const value = draft.trim()
    if (!value || value.length > 120) return setMessage('Enter a location under 120 characters.')
    setBusy(true); setMessage('')
    const sb = supabaseBrowser(), { data: { user } } = await sb.auth.getUser()
    if (!user) { setBusy(false); return setMessage('Log in to change your location.') }
    const { error } = await sb.from('customer_location_preferences').upsert({ user_id: user.id, location_label: value, updated_at: new Date().toISOString() })
    setBusy(false)
    if (error) return setMessage(error.message)
    setLocation(value); setEditing(false); router.refresh()
  }

  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
    <span><small>My Location</small>{editing
      ? <input aria-label="My location" maxLength={120} value={draft} onChange={(e) => setDraft(e.target.value)} />
      : <strong>📍 {location || 'Set your location'}</strong>}</span>
    {editable && (editing
      ? <><button type="button" className="btn sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="btn sm dk" onClick={() => { setDraft(location); setEditing(false); setMessage('') }}>Cancel</button></>
      : <button type="button" className="btn sm dk" onClick={() => { setDraft(location); setEditing(true); setMessage('') }}>Change</button>)}
    {message && <small className="err">{message}</small>}
  </div>
}
