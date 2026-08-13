import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ShipGraph — Who shipped it?',
    short_name: 'ShipGraph',
    description: 'Delivery graph explorer: what broke, who shipped it, who fixed it.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f4f0',
    theme_color: '#16181d',
    icons: [],
  }
}