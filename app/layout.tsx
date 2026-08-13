import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import { ModePill } from '@/components/mode-pill'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'ShipGraph — Who shipped it?',
    template: '%s · ShipGraph',
  },
  description:
    'Delivery graph explorer: what broke, who shipped it, who fixed it. People, code, deploys, and incidents from real open-source projects.',
  applicationName: 'ShipGraph',
}

export const viewport: Viewport = {
  themeColor: '#16181d',
  colorScheme: 'light',
}

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/engineers', label: 'Engineers' },
  { href: '/repos', label: 'Repos' },
  { href: '/incidents', label: 'Incidents' },
  { href: '/pathfinder', label: 'Pathfinder' },
  { href: '/queries', label: 'Queries' },
]

function BrandMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="3" fill="currentColor" />
      <circle cx="18" cy="6" r="3" fill="currentColor" opacity="0.7" />
      <circle cx="12" cy="17" r="4" fill="currentColor" opacity="0.5" />
      <path d="M6 6v0M18 6v0M6 6l12 0M8.4 7.9 10.7 13.6M15.6 7.9 13.3 13.6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="wrap header-inner">
            <Link className="brand" href="/">
              <span className="brand-mark">
                <BrandMark />
              </span>
              <span className="brand-text">ShipGraph</span>
            </Link>
            <nav className="main-nav" aria-label="Primary">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <ModePill />
          </div>
        </header>
        <main id="main" className="site-main">
          <div className="wrap">{children}</div>
        </main>
        <footer className="site-footer">
          <div className="wrap footer-inner">
            <span>ShipGraph · a delivery graph of real open-source data — what broke, who shipped it, who fixed it.</span>
            <span className="footer-note">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="3" fill="var(--accent)" />
                <circle cx="18" cy="6" r="3" fill="var(--accent)" opacity="0.6" />
                <circle cx="12" cy="17" r="4" fill="var(--accent)" opacity="0.4" />
                <path d="M6 6l12 0" stroke="var(--accent)" strokeWidth="1.4" />
              </svg>
              Powered by the ShipGraph graph
            </span>
          </div>
        </footer>
      </body>
    </html>
  )
}