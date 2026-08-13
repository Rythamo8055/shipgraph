import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { searchFixtures } from './mocks'

let pushMock = vi.fn()

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, prefetch: vi.fn() }),
}))

vi.mock('../../components/api', () => ({
  searchApi: vi.fn(),
}))

import { SearchBox, SearchSelect, kindLabel, resultHref } from '../../components/search'
import { searchApi } from '../../components/api'

const searchMock = vi.mocked(searchApi)

describe('resultHref', () => {
  it('maps search kinds to detail routes with encoding', () => {
    expect(resultHref({ kind: 'Engineer', label: 'tj', sub: '' })).toBe('/engineers/tj')
    expect(resultHref({ kind: 'Incident', label: 'github|abc', sub: '' })).toBe('/incidents/github%7Cabc')
    expect(resultHref({ kind: 'Repo', label: 'expressjs/express', sub: '' })).toBe('/repos/expressjs%2Fexpress')
    expect(resultHref({ kind: 'Service' as never, label: 'api', sub: '' })).toBe('')
    expect(resultHref({ kind: 'PullRequest' as never, label: '#42', sub: '' })).toBe('')
  })
})

describe('kindLabel', () => {
  it('shortens PullRequest to PR', () => {
    expect(kindLabel('PullRequest')).toBe('PR')
    expect(kindLabel('Engineer')).toBe('Engineer')
  })
})

describe('SearchBox', () => {
  beforeEach(() => {
    pushMock.mockReset()
    searchMock.mockReset()
    searchMock.mockResolvedValue({ results: searchFixtures })
  })

  it('renders a labelled combobox', () => {
    render(<SearchBox />)
    const input = screen.getByRole('combobox', { name: 'Search people, code, incidents, and services' })
    expect(input).toBeInTheDocument()
  })

  it('debounces input, then shows results with the first active', async () => {
    const user = userEvent.setup()
    render(<SearchBox />)
    await user.type(screen.getByRole('combobox'), 'tj')
    await waitFor(() => expect(searchMock).toHaveBeenCalledWith('tj', expect.any(AbortSignal)))

    const listbox = await screen.findByRole('listbox', { name: 'Search results' })
    expect(listbox).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true')
    const options = screen.getAllByRole('option')
    expect(options.length).toBe(searchFixtures.length)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('does not query for blank input', async () => {
    const user = userEvent.setup()
    render(<SearchBox />)
    await user.type(screen.getByRole('combobox'), '   ')
    await new Promise((r) => setTimeout(r, 400))
    expect(searchMock).not.toHaveBeenCalled()
  })

  it('navigates on Enter for the active option', async () => {
    const user = userEvent.setup()
    render(<SearchBox />)
    await user.type(screen.getByRole('combobox'), 'tj')
    await screen.findByRole('listbox')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/engineers/tj'))
  })

  it('moves the active option with arrow keys and navigates on Enter', async () => {
    const user = userEvent.setup()
    render(<SearchBox />)
    await user.type(screen.getByRole('combobox'), 'tj')
    await screen.findByRole('listbox')
    await user.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(expect.stringContaining('/repos/')))
  })

  it('closes the menu on Escape and lets Enter work afterwards', async () => {
    const user = userEvent.setup()
    render(<SearchBox />)
    await user.type(screen.getByRole('combobox'), 'tj')
    await screen.findByRole('listbox')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/engineers/tj'))
  })

  it('announces an empty result state via role=status', async () => {
    searchMock.mockResolvedValue({ results: [] })
    const user = userEvent.setup()
    render(<SearchBox />)
    await user.type(screen.getByRole('combobox'), 'zzz')
    const status = await screen.findByRole('status')
    expect(status.textContent).toContain('No matches')
  })

  it('navigates to the incident route when the selected result is an incident', async () => {
    searchMock.mockResolvedValue({ results: [searchFixtures[2]] })
    const user = userEvent.setup()
    render(<SearchBox />)
    await user.type(screen.getByRole('combobox'), 'latency')
    await screen.findByRole('listbox')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/incidents/github%7Cabcd1234'))
  })
})

describe('SearchSelect', () => {
  beforeEach(() => {
    searchMock.mockReset()
    searchMock.mockResolvedValue({ results: searchFixtures })
  })

  it('filters results to Engineer kind and selects on click', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<SearchSelect label="Engineer" value={null} onSelect={onSelect} onClear={vi.fn()} />)
    await user.type(screen.getByRole('combobox', { name: 'Search and pick an engineer for Engineer' }), 'tj')
    const options = await screen.findAllByRole('option')
    expect(options.every((o) => o.getAttribute('aria-label')?.startsWith('Engineer'))).toBe(true)
    await user.click(options[0].querySelector('button')!)
    expect(onSelect).toHaveBeenCalledWith('tj')
  })

  it('renders the chosen state with a clear button once selected', async () => {
    const onClear = vi.fn()
    render(<SearchSelect label="Engineer" value="tj" onSelect={vi.fn()} onClear={onClear} />)
    expect(screen.getByText('tj')).toBeInTheDocument()
    const clear = screen.getByRole('button', { name: 'Clear Engineer selection' })
    await userEvent.click(clear)
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})