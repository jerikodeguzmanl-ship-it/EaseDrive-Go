'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CircleMarker, Map as LeafletMap } from 'leaflet'
import { supabaseBrowser } from '@/lib/supabase/client'

type Side = 'customer' | 'owner'
type LiveLocation = {
  user_id: string
  latitude: number
  longitude: number
  accuracy_m: number | null
  location_label: string | null
  updated_at: string
}
type Marker = LiveLocation & { label: string; color: string }

function LocationMap({ markers }: { markers: Marker[] }) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<LeafletMap | null>(null)
  const markerLayers = useRef(new Map<string, CircleMarker>())
  const fitKey = useRef('')

  useEffect(() => {
    let cancelled = false
    import('leaflet').then(({ default: L }) => {
      if (cancelled || !container.current) return
      if (!map.current) {
        map.current = L.map(container.current).setView([14.2, 120.9], 12)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        }).addTo(map.current)
      }

      const current = new Set(markers.map((item) => item.user_id))
      markerLayers.current.forEach((layer, id) => {
        if (!current.has(id)) { layer.remove(); markerLayers.current.delete(id) }
      })
      markers.forEach((item) => {
        const point: [number, number] = [item.latitude, item.longitude]
        const existing = markerLayers.current.get(item.user_id)
        if (existing) existing.setLatLng(point).setStyle({ color: item.color, fillColor: item.color })
        else markerLayers.current.set(item.user_id, L.circleMarker(point, {
          radius: 9, color: item.color, fillColor: item.color, fillOpacity: 0.9, weight: 2,
        }).addTo(map.current!).bindTooltip(item.label))
      })

      const points = markers.map((item) => [item.latitude, item.longitude] as [number, number])

      const nextFitKey = markers.map((item) => `${item.user_id}:${item.latitude.toFixed(3)},${item.longitude.toFixed(3)}`).sort().join('|')
      if (nextFitKey && nextFitKey !== fitKey.current) {
        fitKey.current = nextFitKey
        if (points.length > 1) map.current.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 15 })
        else map.current.setView(points[0], 15)
      }
      map.current.invalidateSize()
    })
    return () => { cancelled = true }
  }, [markers])

  useEffect(() => () => {
    map.current?.remove()
    map.current = null
    markerLayers.current.clear()
  }, [])

  return <div ref={container} role="img" aria-label="Live locations of the customer and vehicle owner" style={{ height: 260, width: '100%', borderRadius: 12, overflow: 'hidden', zIndex: 0 }} />
}

export default function BookingLiveMap({ bookingId, status, side }: { bookingId: string; status: string; side: Side }) {
  const sb = useMemo(() => supabaseBrowser(), [])
  const [enabled, setEnabled] = useState(false)
  const [locations, setLocations] = useState<LiveLocation[]>([])
  const [userId, setUserId] = useState('')
  const [sharing, setSharing] = useState(false)
  const [message, setMessage] = useState('')
  const watchId = useRef<number | null>(null)
  const heartbeatId = useRef<number | null>(null)
  const active = useRef(false)
  const lastSentAt = useRef(0)
  const lastPosition = useRef<GeolocationPosition | null>(null)
  const pendingWrite = useRef<Promise<void>>(Promise.resolve())

  const refresh = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser()
    if (user) setUserId(user.id)
    const { data: control, error: controlError } = await sb.from('booking_location_sharing').select('enabled').eq('booking_id', bookingId).maybeSingle()
    if (controlError) { setMessage(controlError.message); return }
    const isEnabled = !!control?.enabled
    setEnabled(isEnabled)
    if (!isEnabled || status !== 'Confirmed') {
      setLocations([])
      if (watchId.current !== null) {
        active.current = false
        navigator.geolocation.clearWatch(watchId.current)
        watchId.current = null
        if (heartbeatId.current !== null) window.clearInterval(heartbeatId.current)
        heartbeatId.current = null
        setSharing(false)
      }
      return
    }
    const { data, error } = await sb.from('booking_live_locations')
      .select('user_id,latitude,longitude,accuracy_m,location_label,updated_at')
      .eq('booking_id', bookingId)
    if (error) { setMessage(error.message); return }
    setLocations(data ?? [])
  }, [bookingId, sb, status])

  useEffect(() => {
    let mounted = true
    const load = () => { if (mounted) void refresh() }
    load()
    const timer = window.setInterval(load, 5000)
    return () => {
      mounted = false
      window.clearInterval(timer)
      if (watchId.current !== null) {
        active.current = false
        navigator.geolocation.clearWatch(watchId.current)
        watchId.current = null
        if (heartbeatId.current !== null) window.clearInterval(heartbeatId.current)
        heartbeatId.current = null
        void pendingWrite.current.then(() => sb.rpc('stop_booking_live_location', { p_booking: bookingId }))
      }
    }
  }, [bookingId, refresh, sb])

  const stopSharing = useCallback(async () => {
    active.current = false
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
    if (heartbeatId.current !== null) window.clearInterval(heartbeatId.current)
    heartbeatId.current = null
    lastPosition.current = null
    setSharing(false)
    await pendingWrite.current
    const { error } = await sb.rpc('stop_booking_live_location', { p_booking: bookingId })
    if (error) setMessage(error.message)
    else { setMessage('Location sharing stopped.'); await refresh() }
  }, [bookingId, refresh, sb])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && watchId.current !== null) void stopSharing()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [stopSharing])

  async function startSharing() {
    setMessage('')
    if (!enabled || status !== 'Confirmed') return setMessage('Live sharing is unavailable for this booking.')
    if (!navigator.geolocation) return setMessage('This browser does not support GPS location.')
    const { data: { user }, error: authError } = await sb.auth.getUser()
    if (authError || !user) return setMessage(authError?.message || 'Log in to share your location.')
    let locationLabel: string | null = null
    if (side === 'customer') {
      const { data: preference, error } = await sb.from('customer_location_preferences')
        .select('location_label').eq('user_id', user.id).maybeSingle()
      if (error) return setMessage(error.message)
      locationLabel = preference?.location_label ?? null
    }
    setUserId(user.id)
    active.current = true
    lastSentAt.current = 0
    lastPosition.current = null
    const sendPosition = (position: GeolocationPosition) => {
      if (!active.current || Date.now() - lastSentAt.current < 5000) return
      lastSentAt.current = Date.now()
      pendingWrite.current = pendingWrite.current.then(async () => {
        if (!active.current) return
        const { error } = await sb.rpc('share_booking_live_location', {
          p_booking: bookingId,
          p_latitude: position.coords.latitude,
          p_longitude: position.coords.longitude,
          p_accuracy_m: position.coords.accuracy,
          p_location_label: locationLabel,
        })
        if (error) {
          setMessage(error.message)
          active.current = false
          if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
          watchId.current = null
          if (heartbeatId.current !== null) window.clearInterval(heartbeatId.current)
          heartbeatId.current = null
          setSharing(false)
          return
        }
        await refresh()
      })
    }
    watchId.current = navigator.geolocation.watchPosition((position) => {
      lastPosition.current = position
      sendPosition(position)
    }, (error) => {
      setMessage(error.message || 'Could not read your GPS location.')
      void stopSharing()
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 })
    heartbeatId.current = window.setInterval(() => {
      if (lastPosition.current) sendPosition(lastPosition.current)
    }, 20000)
    setSharing(true)
  }

  if (status !== 'Confirmed') return null

  const markers: Marker[] = locations.map((location) => ({
    ...location,
    label: location.user_id === userId ? 'You' : `${side === 'customer' ? 'Vehicle owner' : 'Customer'}${location.location_label ? ` · ${location.location_label}` : ''}`,
    color: location.user_id === userId ? '#b38b00' : '#2878b5',
  }))
  const customerSharing = locations.some((location) => (side === 'customer' ? location.user_id === userId : location.user_id !== userId))
  const ownerSharing = locations.some((location) => (side === 'owner' ? location.user_id === userId : location.user_id !== userId))

  return <div className="panel" style={{ marginTop: 10 }}>
    <h3>Live booking location</h3>
    {!enabled
      ? <small style={{ color: 'var(--m)' }}>Live sharing is waiting for admin to enable it for this confirmed booking.</small>
      : <>
        <p style={{ color: 'var(--m)', margin: '4px 0 8px' }}>Customer: {customerSharing ? 'Sharing' : 'Waiting'} · Vehicle owner: {ownerSharing ? 'Sharing' : 'Waiting'}</p>
        <button type="button" className="btn sm" onClick={sharing ? stopSharing : startSharing}>{sharing ? 'Stop sharing my location' : 'Share my live location'}</button>
        {markers.length > 0 && <div style={{ marginTop: 10 }}><LocationMap markers={markers} /></div>}
        <small style={{ display: 'block', color: 'var(--m)', marginTop: 6 }}>GPS runs only while this page is open. Map tiles © OpenStreetMap contributors; tile requests may indicate the area being viewed. Admin cannot view live coordinates.</small>
      </>}
    {message && <small className="err" style={{ display: 'block', marginTop: 6 }}>{message}</small>}
  </div>
}

export function AdminBookingLocationControl({ bookingId, status }: { bookingId: string; status: string }) {
  const sb = useMemo(() => supabaseBrowser(), [])
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true
    sb.from('booking_location_sharing').select('enabled').eq('booking_id', bookingId).maybeSingle().then(({ data, error }) => {
      if (!mounted) return
      if (error) setMessage(error.message)
      else setEnabled(!!data?.enabled)
      setBusy(false)
    })
    return () => { mounted = false }
  }, [bookingId, sb])

  async function toggle() {
    setBusy(true); setMessage('')
    const next = !enabled
    const { error } = await sb.rpc('admin_set_booking_location_sharing', { p_booking: bookingId, p_enabled: next })
    setBusy(false)
    if (error) setMessage(error.message)
    else setEnabled(next)
  }

  return <div style={{ marginTop: 4 }}>
    <button type="button" className="btn sm dk" disabled={busy || (status !== 'Confirmed' && !enabled)} onClick={toggle}>
      {busy ? '…' : enabled ? 'Disable live location' : 'Enable live location'}
    </button>
    {status !== 'Confirmed' && !enabled && <small style={{ display: 'block', color: 'var(--m)' }}>Available after confirmation.</small>}
    {message && <small className="err" style={{ display: 'block' }}>{message}</small>}
  </div>
}
