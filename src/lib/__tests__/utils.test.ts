import { describe, it, expect } from 'vitest'
import { formatPhoneE164, formatCurrency, formatRelativeTime, cn } from '../utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('resolves Tailwind conflicts', () => {
    expect(cn('p-4', 'p-6')).toBe('p-6')
  })
})

describe('formatPhoneE164', () => {
  it('converts 10-digit US number', () => {
    expect(formatPhoneE164('5551234567')).toBe('+15551234567')
  })

  it('handles formatted numbers', () => {
    expect(formatPhoneE164('(555) 123-4567')).toBe('+15551234567')
  })

  it('handles 11-digit number starting with 1', () => {
    expect(formatPhoneE164('15551234567')).toBe('+15551234567')
  })

  it('returns null for too-short input', () => {
    expect(formatPhoneE164('123')).toBeNull()
  })
})

describe('formatCurrency', () => {
  it('formats USD', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })
})

describe('formatRelativeTime', () => {
  it('returns "just now" for recent timestamps', () => {
    const now = new Date()
    expect(formatRelativeTime(now)).toBe('just now')
  })

  it('returns minutes ago', () => {
    const d = new Date(Date.now() - 5 * 60000)
    expect(formatRelativeTime(d)).toBe('5m ago')
  })

  it('returns hours ago', () => {
    const d = new Date(Date.now() - 3 * 3600000)
    expect(formatRelativeTime(d)).toBe('3h ago')
  })
})
