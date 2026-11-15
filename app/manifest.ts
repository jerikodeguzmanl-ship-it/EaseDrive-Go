import type { MetadataRoute } from 'next'
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'EaseDrive Go', short_name: 'EaseDrive', description: 'Your Journey, Your Choice.', start_url: '/', display: 'standalone', background_color: '#F8F8F8', theme_color: '#202020', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }] }
}
