'use client'

import { useState, type ReactNode } from 'react'
import type { Impact } from './types'
import { titleCase } from './format'

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="spinner-label">{label}</span>
    </div>
  )
}

export function SkeletonBlock({ lines = 3, ariaLabel = 'Loading' }: { lines?: number; ariaLabel?: string }) {
  return (
    <div className="skeleton-block" role="status" aria-label={ariaLabel}>
      <span className="visually-hidden">{ariaLabel}</span>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton" style={{ width: `${98 - i * 9}%` }} />
      ))}
    </div>
  )
}

export function CardSkeleton({ count = 4, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <div className="grid cards-grid" role="status" aria-label={label}>
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card card-skeleton">
          <span className="skeleton" style={{ width: '60%' }} />
          <span className="skeleton skeleton-lg" style={{ width: '40%' }} />
          <span className="skeleton" style={{ width: '80%' }} />
        </div>
      ))}
    </div>
  )
}

export function ErrorBanner({
  message = 'Graph database unreachable.',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="error-banner" role="alert">
      <svg className="err-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3 2.5 20h19L12 3Zm0 5.5v5m0 3.5v.01"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="err-body">
        <strong>Graph database unreachable.</strong>
        <span>{message} The server may still be starting — wait a moment and try again.</span>
      </div>
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string
  hint?: string
  icon?: 'inbox' | 'search' | 'path' | 'repo'
}) {
  return (
    <div className="empty-state">
      <svg className="empty-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {icon === 'search' ? (
          <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35M21 21l-1 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        ) : icon === 'path' ? (
          <path d="M5 9V6a1 1 0 0 1 1-1h13M5 15v3a1 1 0 0 0 1 1h13M9 8.5l-4 3.5 4 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        ) : icon === 'repo' ? (
          <path
            d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Zm3 9h5m-5-4h10M7 5v3m0 0v11"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1H4V6Zm-1 3h18l-1.2 11a2 2 0 0 1-2 1.8H6.2a2 2 0 0 1-2-1.8L3 9Zm6 4v2h6v-2H9Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
    </div>
  )
}

const impactClass: Record<Impact, string> = {
  critical: 'impact-critical',
  major: 'impact-major',
  minor: 'impact-minor',
  none: 'impact-none',
  maintenance: 'impact-maintenance',
}

export function ImpactChip({ impact }: { impact: Impact }) {
  return <span className={`chip impact-chip ${impactClass[impact] ?? 'impact-minor'}`}>{titleCase(impact)}</span>
}

export function StatusPill({ resolved }: { resolved: boolean }) {
  return (
    <span className={`chip status-pill ${resolved ? 'status-resolved' : 'status-ongoing'}`}>
      <span className="status-dot" aria-hidden="true" />
      {resolved ? 'Resolved' : 'Ongoing'}
    </span>
  )
}

export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="avatar" src={src} alt="" width={size} height={size} loading="lazy" />
  ) : (
    <span className="avatar avatar-fallback" style={{ width: size, height: size }} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch {
        /* ignore */
      }
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button type="button" className="btn btn-dark btn-sm copy-btn" onClick={copy} aria-label={`${label} query`} data-copied={copied}>
      <span className="visually-hidden" role="status">{copied ? 'Copied to clipboard' : ''}</span>
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.7" />
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="section-title">{children}</h2>
}