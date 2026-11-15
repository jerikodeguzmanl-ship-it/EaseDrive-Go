'use client'
import Link from 'next/link'
import CarArt from '@/components/CarArt'
import PhoneFrame from '@/components/PhoneFrame'
import MyLocation from '@/components/MyLocation'
import HeroSlider from '@/components/HeroSlider'

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

export default function CustomerHome({ loggedIn, locationLabel, canEditLocation, view, vehicles, categories, category, query, heroImages }: Props) {
  if (view === 'welcome') return <PhoneFrame fullBleed><HeroSlider images={heroImages} loggedIn={loggedIn} /></PhoneFrame>

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
