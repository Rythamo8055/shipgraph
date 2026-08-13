'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { searchApi } from './api'
import type { SearchResult } from './types'

const DEBOUNCE_MS = 250

export function resultHref(r: SearchResult): string {
  switch (r.kind) {
    case 'Engineer':
      return `/engineers/${encodeURIComponent(r.label)}`
    case 'Repo':
      return `/repos/${encodeURIComponent(r.label)}`
    case 'Incident':
      return `/incidents/${encodeURIComponent(r.label)}`
    default:
      return ''
  }
}

export function resultIcon(kind: SearchResult['kind']) {
  switch (kind) {
    case 'Engineer':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7" />
          <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      )
    case 'Repo':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Zm6 9h5m-5-4h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'PullRequest':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="6" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="18" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.7" />
          <path d="M6 8.5v7M18 10v4.5" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      )
    case 'Incident':
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3 2.5 20h19L12 3Zm0 5.5v5m0 3.5v.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 21v-7m7 7v-7m7 7v-7M4 8l8-5 8 5-8 5-8-5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
  }
}

export function kindLabel(kind: SearchResult['kind']): string {
  return kind === 'PullRequest' ? 'PR' : kind
}

export function SearchBox({ size = 'lg', placeholder }: { size?: 'lg' | 'sm'; placeholder?: string }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState(-1)
  const boxRef = useRef<HTMLDivElement>(null)
  const reqRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const router = useRouter()

  useEffect(() => {
    const id = ++reqRef.current
    abortRef.current?.abort()
    abortRef.current = null
    const t = setTimeout(() => {
      const term = q.trim()
      if (term.length < 1) {
        setResults([])
        setBusy(false)
        return
      }
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setBusy(true)
      searchApi(term, ctrl.signal)
        .then((r) => {
          if (reqRef.current !== id || ctrl.signal.aborted) return
          setResults(r.results)
          setOpen(true)
          setActive(r.results.length ? 0 : -1)
        })
        .catch(() => {
          if (reqRef.current !== id || ctrl.signal.aborted) return
          setResults([])
        })
        .finally(() => {
          if (reqRef.current === id) setBusy(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      abortRef.current?.abort()
    }
  }, [q])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function go(r: SearchResult | undefined) {
    if (!r) return
    const href = resultHref(r)
    if (href) {
      setOpen(false)
      setQ('')
      router.push(href)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) {
      if (e.key === 'Enter') {
        const first = results[0]
        if (first) go(first)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a <= 0 ? results.length - 1 : a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(results[active >= 0 ? active : 0])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={`searchbox ${size === 'lg' ? 'searchbox-lg' : ''}`} ref={boxRef}>
      <div className="searchbox-field">
        <svg className="searchbox-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="m20 20-3.3-3.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => results.length && setOpen(true)}
          role="combobox"
          aria-expanded={open}
          aria-controls="search-results"
          aria-autocomplete="list"
          aria-label="Search people, code, incidents, and services"
          placeholder={placeholder ?? 'Search engineers, repos, PRs, incidents…'}
          autoComplete="off"
        />
        {busy && <span className="searchbox-busy" aria-hidden="true" />}
      </div>
      {open && results.length > 0 && (
        <ul className="searchbox-menu" id="search-results" role="listbox" aria-label="Search results">
          {results.map((r, i) => {
            const href = resultHref(r)
            const item = (
              <>
                <span className="search-kind" aria-hidden="true">
                  {resultIcon(r.kind)}
                </span>
                <span className="search-main">
                  <span className="search-label">{r.label}</span>
                  <span className="search-sub">{r.sub}</span>
                </span>
                <span className="search-kind-tag">{kindLabel(r.kind)}</span>
              </>
            )
            return (
              <li key={r.kind + ':' + r.label} role="option" aria-selected={i === active} aria-label={`${kindLabel(r.kind)} ${r.label} — ${r.sub}`}>
                {href ? (
                  <Link
                    href={href}
                    className={`search-item ${i === active ? 'is-active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOpen(false)
                      setQ('')
                    }}
                  >
                    {item}
                  </Link>
                ) : (
                  <span className={`search-item ${i === active ? 'is-active' : ''}`} onMouseEnter={() => setActive(i)}>
                    {item}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {open && q.trim().length > 1 && !busy && results.length === 0 && (
        <div className="searchbox-empty" role="status">
          No matches for “{q}” — try a repo name, a login, or an incident.
        </div>
      )}
    </div>
  )
}

export function SearchSelect({
  label,
  value,
  onSelect,
  onClear,
}: {
  label: string
  value: string | null
  onSelect: (login: string) => void
  onClear: () => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const reqRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const id = ++reqRef.current
    abortRef.current?.abort()
    abortRef.current = null
    const t = setTimeout(() => {
      const term = q.trim()
      if (term.length < 1) {
        setResults([])
        setBusy(false)
        return
      }
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setBusy(true)
      searchApi(term, ctrl.signal)
        .then((r) => {
          if (reqRef.current !== id || ctrl.signal.aborted) return
          const engineers = r.results.filter((x) => x.kind === 'Engineer')
          setResults(engineers)
          if (engineers.length) setOpen(true)
        })
        .catch(() => {
          if (reqRef.current !== id || ctrl.signal.aborted) return
          setResults([])
        })
        .finally(() => {
          if (reqRef.current === id) setBusy(false)
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      abortRef.current?.abort()
    }
  }, [q])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  if (value) {
    return (
      <div className="searchselect searchselect-chosen" ref={boxRef}>
        <span className="field-label">{label}</span>
        <span className="chosen-chip">
          {value}
          <button type="button" className="chosen-clear" onClick={onClear} aria-label={`Clear ${label} selection`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      </div>
    )
  }

  return (
    <div className="searchselect" ref={boxRef}>
      <label className="field-label" htmlFor={label}>
        {label}
      </label>
      <input
        id={label}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        role="combobox"
        aria-expanded={open}
        aria-label={`Search and pick an engineer for ${label}`}
        placeholder="Type an engineer login…"
      />
      {open && results.length > 0 && (
        <ul className="searchbox-menu" role="listbox" aria-label={`${label} results`}>
          {results.map((r) => (
            <li key={r.label} role="option" aria-selected="false" aria-label={`Engineer ${r.label}`}>
              <button
                type="button"
                className="search-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(r.label)
                  setOpen(false)
                  setQ('')
                }}
              >
                <span className="search-kind" aria-hidden="true">
                  {resultIcon('Engineer')}
                </span>
                <span className="search-main">
                  <span className="search-label">{r.label}</span>
                  <span className="search-sub">{r.sub}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && q.trim().length > 1 && !busy && results.length === 0 && (
        <div className="searchbox-empty" role="status">
          No engineer matches “{q}”.
        </div>
      )}
    </div>
  )
}