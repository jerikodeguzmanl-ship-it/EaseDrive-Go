import { supabaseServer } from '@/lib/supabase/server'
import { pub } from '@/lib/format'
import CustomerHome from '@/components/CustomerHome'

export default async function Home({ searchParams }: { searchParams: Promise<{ category?: string; q?: string; view?: string }> }) {
  const { category = 'All', q = '', view = '' } = await searchParams
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  const { data: profile } = user
    ? await sb.from('profiles').select('role').eq('id', user.id).maybeSingle()
    : { data: null }
  const { data: locationPreference } = user && profile?.role === 'customer'
    ? await sb.from('customer_location_preferences').select('location_label').eq('user_id', user.id).maybeSingle()
    : { data: null }
  let qb = sb.from('vehicles').select('id,name,model_year,category,transmission,seats,fuel,location,status,vehicle_images(storage_path,sort),business_owners(business_name)').eq('status', 'Published')
  if (category !== 'All') qb = qb.eq('category', category)
  if (q) qb = qb.ilike('name', `%${q}%`)
  const { data: cars } = await qb.order('created_at', { ascending: false })
  const { data: hero } = await sb.from('hero_images').select('storage_path').order('sort')
  const categories = ['All', ...new Set((cars ?? []).map((car: any) => car.category).filter(Boolean))]
  const vehicles = (cars ?? []).map((car: any) => {
    const image = [...(car.vehicle_images ?? [])].sort((a: any, b: any) => a.sort - b.sort)[0]
    return {
      id: car.id, name: car.name, model_year: car.model_year, category: car.category,
      transmission: car.transmission, seats: car.seats, fuel: car.fuel, location: car.location,
      image: image ? pub('vehicles', image.storage_path) : null,
      partner: car.business_owners?.business_name ?? 'Local rental partner',
      status: car.status,
    }
  })
  return <CustomerHome loggedIn={!!user} locationLabel={locationPreference?.location_label || 'Cavite'} canEditLocation={profile?.role === 'customer'} view={view === 'explore' ? 'explore' : 'welcome'} vehicles={vehicles} categories={categories} category={category} query={q} heroImages={(hero ?? []).map((image: any) => pub('hero', image.storage_path))} />
}
