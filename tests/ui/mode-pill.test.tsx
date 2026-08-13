import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../components/api', () => ({
  useMode: vi.fn(),
}))

import { ModePill } from '../../components/mode-pill'
import { useMode } from '../../components/api'

const useModeMock = vi.mocked(useMode)

describe('ModePill', () => {
  it('reports the checking state with a status title', () => {
    useModeMock.mockReturnValue('checking')
    render(<ModePill />)
    expect(screen.getByText('checking…')).toBeInTheDocument()
    expect(screen.getByTitle('Checking database connection…')).toBeInTheDocument()
  })

  it('reports live database when connected', () => {
    useModeMock.mockReturnValue('live')
    render(<ModePill />)
    expect(screen.getByText('live database')).toBeInTheDocument()
    expect(screen.getByTitle(/live delivery graph database/)).toBeInTheDocument()
  })

  it('reports sample data mode honestly when db is unreachable', () => {
    useModeMock.mockReturnValue('sample')
    render(<ModePill />)
    expect(screen.getByText('sample data mode')).toBeInTheDocument()
    expect(screen.getByTitle(/sample data from fixtures/)).toBeInTheDocument()
  })
})