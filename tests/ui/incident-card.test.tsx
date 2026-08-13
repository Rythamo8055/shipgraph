import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import { IncidentCard } from '../../components/incident-card'
import { incidentSnapshot } from './mocks'

describe('IncidentCard', () => {
  it('renders impact, status, name, source, and service chips', () => {
    render(<IncidentCard incident={incidentSnapshot} />)
    expect(screen.getByText('Major')).toBeInTheDocument()
    expect(screen.getByText('Resolved')).toBeInTheDocument()
    expect(screen.getByText('API latency spike')).toBeInTheDocument()
    expect(screen.getByText('api.statuspage.com')).toBeInTheDocument()
    expect(screen.getByText('api')).toBeInTheDocument()
    expect(screen.getByText('graphql')).toBeInTheDocument()
  })

  it('renders a relative age for the incident', () => {
    render(<IncidentCard incident={incidentSnapshot} />)
    expect(screen.getByText(/d ago$/)).toBeInTheDocument()
  })

  it('links to the incident detail page with an encoded key', () => {
    render(<IncidentCard incident={incidentSnapshot} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/incidents/github%7Cabcd1234')
  })

  it('shows Ongoing for unresolved incidents', () => {
    render(<IncidentCard incident={{ ...incidentSnapshot, resolvedAt: null }} />)
    expect(screen.getByText('Ongoing')).toBeInTheDocument()
  })
})