import { describe, expect, it } from 'vitest'
import { fmtDate, fmtDateTime, fmtNum, fmtRelative, fmtStars, shortSha, titleCase } from '../../components/format'

describe('fmtNum', () => {
  it('uses en-US grouping', () => {
    expect(fmtNum(3810)).toBe('3,810')
    expect(fmtNum(1_000_000)).toBe('1,000,000')
    expect(fmtNum(0)).toBe('0')
  })
})

describe('fmtStars', () => {
  it('keeps small numbers verbatim', () => {
    expect(fmtStars(999)).toBe('999')
  })
  it('compacts thousands', () => {
    expect(fmtStars(1000)).toBe('1k')
    expect(fmtStars(1500)).toBe('1.5k')
  })
  it('compacts millions', () => {
    expect(fmtStars(1_000_000)).toBe('1M')
    expect(fmtStars(12_400_000)).toBe('12.4M')
    expect(fmtStars(100_000_000)).toBe('100M')
  })
})

describe('fmtRelative', () => {
  it('returns an em dash for missing dates', () => {
    expect(fmtRelative(null)).toBe('—')
    expect(fmtRelative(undefined)).toBe('—')
  })
  it('returns the input verbatim for unparseable dates', () => {
    expect(fmtRelative('not-a-date')).toBe('not-a-date')
  })
  it('renders scale-appropriate buckets', () => {
    const now = Date.now()
    expect(fmtRelative(new Date(now - 30_000).toISOString())).toBe('just now')
    expect(fmtRelative(new Date(now - 5 * 60_000).toISOString())).toBe('5m ago')
    expect(fmtRelative(new Date(now - 3 * 3_600_000).toISOString())).toBe('3h ago')
    expect(fmtRelative(new Date(now - 2 * 86_400_000).toISOString())).toBe('2d ago')
    expect(fmtRelative(new Date(now - 200 * 86_400_000).toISOString())).toBe('6mo ago')
    expect(fmtRelative(new Date(now - 730 * 86_400_000).toISOString())).toBe('2y ago')
  })
  it('treats future timestamps as just now', () => {
    expect(fmtRelative(new Date(Date.now() + 60_000).toISOString())).toBe('just now')
  })
})

describe('fmtDate / fmtDateTime', () => {
  it('returns an em dash for missing dates', () => {
    expect(fmtDate(null)).toBe('—')
    expect(fmtDateTime(undefined)).toBe('—')
  })
  it('renders readable date strings', () => {
    expect(fmtDate('2024-03-14T10:00:00Z')).toMatch(/Mar 14, 2024/)
    expect(fmtDateTime('2024-03-14T10:00:00Z')).toMatch(/Mar 14, 2024/)
    expect(fmtDateTime('2024-03-14T10:00:00Z')).toMatch(/10:00/)
  })
})

describe('shortSha', () => {
  it('truncates long SHAs to 10 chars', () => {
    expect(shortSha('a1b2c3d4e5f6a7b8c9d0')).toBe('a1b2c3d4e5')
  })
  it('keeps short strings intact', () => {
    expect(shortSha('abc')).toBe('abc')
  })
})

describe('titleCase', () => {
  it('capitalizes single words', () => {
    expect(titleCase('critical')).toBe('Critical')
  })
  it('lowercases the remainder', () => {
    expect(titleCase('MAINTENANCE')).toBe('Maintenance')
  })
  it('handles empty strings', () => {
    expect(titleCase('')).toBe('')
  })
})