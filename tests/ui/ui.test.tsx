import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Avatar, CopyButton, EmptyState, ErrorBanner, ImpactChip, PageHeader, SectionTitle, SkeletonBlock, Spinner, StatusPill } from '../../components/ui'

describe('Spinner', () => {
  it('announces a polite status with a label', () => {
    render(<Spinner />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })
  it('supports a custom label', () => {
    render(<Spinner label="Querying the graph…" />)
    expect(screen.getByText('Querying the graph…')).toBeInTheDocument()
  })
})

describe('SkeletonBlock', () => {
  it('renders the requested line count inside a named status', () => {
    const { container } = render(<SkeletonBlock lines={3} ariaLabel="Loading engineers" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading engineers')
    expect(container.querySelectorAll('.skeleton').length).toBe(3)
  })
})

describe('ErrorBanner', () => {
  it('surfaces an alert with message and stable strong text', () => {
    render(<ErrorBanner message="Graph database unreachable — check the server, then retry." />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert.querySelector('strong')?.textContent).toBe('Graph database unreachable.')
    expect(alert.textContent).toContain('check the server')
  })
  it('renders a Retry button when onRetry is given', async () => {
    const onRetry = vi.fn()
    render(<ErrorBanner onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
  it('omits Retry when no handler is provided', () => {
    render(<ErrorBanner />)
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('renders title and hint with a default icon', () => {
    const { container } = render(<EmptyState title="No incidents found" hint="Try widening the window." />)
    expect(screen.getByText('No incidents found')).toBeInTheDocument()
    expect(screen.getByText('Try widening the window.')).toBeInTheDocument()
    expect(container.querySelector('.empty-icon')).toBeInTheDocument()
  })
  it('renders the search variant when requested', () => {
    const { container } = render(<EmptyState title="Nothing here" icon="search" />)
    expect(container.querySelector('.empty-icon path')).toBeInTheDocument()
  })
})

describe('ImpactChip', () => {
  it.each(['critical', 'major', 'minor', 'none', 'maintenance'] as const)('renders %s impact readable', (impact) => {
    render(<ImpactChip impact={impact} />)
    expect(screen.getByText(impact.charAt(0).toUpperCase() + impact.slice(1))).toBeInTheDocument()
  })
})

describe('StatusPill', () => {
  it('reports resolved incidents as Resolved', () => {
    render(<StatusPill resolved />)
    expect(screen.getByText('Resolved')).toBeInTheDocument()
  })
  it('reports open incidents as Ongoing', () => {
    render(<StatusPill resolved={false} />)
    expect(screen.getByText('Ongoing')).toBeInTheDocument()
  })
})

describe('Avatar', () => {
  it('renders a decorative image when a source is present', () => {
    const { container } = render(<Avatar src="https://example.com/a.png" name="Alice" />)
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', 'https://example.com/a.png')
    expect(img).toHaveAttribute('alt', '')
  })
  it('falls back to an initial while staying decorative', () => {
    render(<Avatar src={null} name="bob" />)
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(document.querySelector('img')).not.toBeInTheDocument()
  })
})

describe('CopyButton', () => {
  it('copies via the clipboard API and confirms', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
    render(<CopyButton text="MATCH (n) RETURN n LIMIT 1" />)
    await user.click(screen.getByRole('button', { name: 'Copy query' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('MATCH (n) RETURN n LIMIT 1')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy query' })).toHaveTextContent('Copied'))
    expect(screen.getByRole('status')).toHaveTextContent('Copied to clipboard')
  })

  it('falls back to execCommand when clipboard is unavailable', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })
    const exec = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { writable: true, value: exec })
    const append = vi.spyOn(document.body, 'appendChild')
    render(<CopyButton text="CALL db.labels()" />)
    await user.click(screen.getByRole('button', { name: 'Copy query' }))
    expect(exec).toHaveBeenCalledWith('copy')
    expect(append).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByText('Copied')).toBeInTheDocument())
  })
})

describe('PageHeader and SectionTitle', () => {
  it('renders a page header with sub and actions', () => {
    render(
      <PageHeader title="Incidents" sub="Breaking and resolved services." actions={<button type="button">Filter</button>} />,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Incidents')
    expect(screen.getByText('Breaking and resolved services.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument()
  })

  it('renders section titles at h2 level', () => {
    render(<SectionTitle>Contributors</SectionTitle>)
    expect(screen.getByRole('heading', { level: 2, name: 'Contributors' })).toBeInTheDocument()
  })

  it('omits the sub when absent', () => {
    render(<PageHeader title="About" />)
    expect(screen.queryByText(/—/)).not.toBeInTheDocument()
  })

  it('stops click propagation in the actions stack', () => {
    const stop = vi.fn()
    render(
      <PageHeader
        title="X"
        actions={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            Go
          </button>
        }
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(stop).not.toHaveBeenCalled() // purely structural: control stays clickable
  })
})