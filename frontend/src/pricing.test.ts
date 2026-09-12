import { describe, expect, it } from 'vitest'
import { formatUsd } from './pricing'

describe('formatUsd', () => {
  it('formats a metal price as USD with two decimals', () => {
    expect(formatUsd(2345.12)).toBe('$2,345.12')
  })

  it('rounds fractional cents consistently', () => {
    expect(formatUsd(27.416)).toBe('$27.42')
  })
})