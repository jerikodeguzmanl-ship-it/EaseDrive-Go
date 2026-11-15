'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import CarArt from '@/components/CarArt'
import PhoneFrame from '@/components/PhoneFrame'
import MyLocation from '@/components/MyLocation'

type Vehicle = {
  id: string
  name: string
  model_year: number
  category: string
  transmission: string
  seats: number
  fuel: string
  location: string
  image: string | null
  partner: string
  selfDrive?: number | null
  withDriver?: number | null
  status: string
}

type Props = {
  loggedIn: boolean
  locationLabel: string
  canEditLocation: boolean
  view: 'welcome' | 'explore'
  vehicles: Vehicle[]
  categories: string[]
  category: string
  query: string
  heroImages: string[]
}

const slideColors = [
  { glow: '#d6a21a', car: '#2a2a2a' },
  { glow: '#7a8fa3', car: '#e9e9e9' },
  { glow: '#4f7a5a', car: '#8a1f1f' },
]

export default function CustomerHome({ loggedIn, locationLabel, canEditLocation, view, vehicles, categories, category, query, heroImages }: Props) {
  const [slide, setSlide] = useState(0)
  const slideCount = heroImages.length || slideColors.length
  useEffect(() => {
    const timer = window.setInterval(() => setSlide((value) => (value + 1) % slideCount), 3500)
    return () => window.clearInterval(timer)
  }, [slideCount])

  if (view === 'welcome') return <PhoneFrame>
    <section className="welcome-hero">
      <div className="slides" style={{ transform: `translateX(-${slide * 100}%)` }}>
        {(heroImages.length ? heroImages : slideColors.map((item) => item.glow)).map((item, index) => {
          const fallback = slideColors[index % slideColors.length]
          return <div className="slide" key={item} style={{ background: heroImages.length ? `url("${item}") center / cover` : `radial-gradient(circle at 50% 35%, ${fallback.glow}55, #151515 70%)` }}>
            {!heroImages.length && <CarArt color={fallback.car} />}
          </div>
        })}
      </div>
      <div className="welcome-brand"><i>E</i>EaseDrive Go</div>
      <h1>Find Your Ride. Enjoy the Journey.</h1>
      <p>Discover reliable vehicles for your next trip, available from trusted local rental partners.</p>
      <div className="dots" aria-label={`Slide ${slide + 1}`}>
        {(heroImages.length ? heroImages : slideColors).map((_, index) => <i className={index === slide ? 'on' : ''} key={index} />)}
      </div>
      <Link className="btn" href="/?view=explore#vehicles">Get Started</Link>
      {!loggedIn && <p className="welcome-login">Already have an account? <Link href="/login">Log In</Link></p>}
    </section>
  </PhoneFrame>

  return <PhoneFrame active="explore">
    <div className="customer-screen">
      <div className="location-row"><MyLocation initialLocation={locationLabel} editable={canEditLocation} /><Link href={loggedIn ? '/bookings' : '/login'} className="avatar-link" aria-label={loggedIn ? 'My bookings' : 'Log in'}>E</Link></div>
      <h1>Ready for your next journey?</h1>
      <p className="sub">Choose a ride from trusted local partners.</p>
      <form className="phone-search" action="/">
        <input type="hidden" name="view" value="explore" />
        <input name="q" defaultValue={query} placeholder="Search vehicle name" aria-label="Search vehicle name" />
        <button aria-label="Search">⌕</button>
      </form>
      <div className="row" aria-label="Vehicle categories">
        {categories.map((item) => <Link key={item} className={`chip${category === item ? ' on' : ''}`} href={`/?view=explore&category=${encodeURIComponent(item)}#vehicles`}>{item}</Link>)}
      </div>
      <div className="list-heading" id="vehicles"><b>Nearby You</b><span>{vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'}</span></div>
      <div className="vehicle-grid">{vehicles.length ? vehicles.map((vehicle) => <Link href={`/vehicles/${vehicle.id}`} className="card vehicle-card" key={vehicle.id}>
        <div className="vehicle-card-heading"><b>{vehicle.name}</b><span className={`pill ${vehicle.status === 'Published' ? 'g' : 'o'}`}>{vehicle.status === 'Published' ? 'Available' : vehicle.status}</span></div>
        <small className="vehicle-caption">{vehicle.model_year} · {vehicle.partner} · {vehicle.location}</small>
        {vehicle.image ? <img className="vehicle-image" src={vehicle.image} alt={vehicle.name} /> : <div className="vehicle-art"><CarArt /></div>}
        <div className="meta"><span>{vehicle.transmission}</span><span>{vehicle.seats} seats</span><span>{vehicle.fuel}</span></div>
        <div className="vehicle-card-bottom"><small>Self Drive · With Driver</small><strong>Check rates →</strong></div>
      </Link>) : <div className="empty">{query ? 'Walang tugmang sasakyan.' : 'No vehicles available yet.'}</div>}</div>
      <Link className="card partner-invite" href="/apply"><b>May rental business ka?</b><small>Mag-apply bilang verified partner →</small></Link>
    </div>
  </PhoneFrame>
}
