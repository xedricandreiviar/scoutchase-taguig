import { describe, it, expect } from 'vitest'
import {
  calculateServicePoints,
  calculateMonthlyServicePoints,
  SERVICE_POINTS_MONTHLY_CAP,
  POINTS_PER_HOUR,
  POINTS_PER_HALF_HOUR,
} from './service-points'

describe('calculateServicePoints', () => {
  it('returns 0 for 0 hours', () => {
    expect(calculateServicePoints(0)).toBe(0)
  })

  it('returns 0 for negative hours', () => {
    expect(calculateServicePoints(-1)).toBe(0)
  })

  it('returns 10 points for 1 hour', () => {
    expect(calculateServicePoints(1)).toBe(10)
  })

  it('returns 50 points for 5 hours', () => {
    expect(calculateServicePoints(5)).toBe(50)
  })

  it('adds 5 points for fractional >= 0.5 (e.g., 2.5 hours = 25)', () => {
    expect(calculateServicePoints(2.5)).toBe(25)
  })

  it('does not add 5 points for fractional < 0.5 (e.g., 2.3 hours = 20)', () => {
    expect(calculateServicePoints(2.3)).toBe(20)
  })

  it('handles exactly 0.5 hours (0 full hours + 5 for half)', () => {
    expect(calculateServicePoints(0.5)).toBe(5)
  })

  it('handles 24 hours (maximum allowed service log)', () => {
    expect(calculateServicePoints(24)).toBe(240)
  })

  it('handles 3.7 hours (3 full hours = 30, fractional 0.7 >= 0.5 → +5 = 35)', () => {
    expect(calculateServicePoints(3.7)).toBe(35)
  })

  it('handles 3.4 hours (3 full hours = 30, fractional 0.4 < 0.5 → 30)', () => {
    expect(calculateServicePoints(3.4)).toBe(30)
  })
})

describe('calculateMonthlyServicePoints', () => {
  it('returns full new points when no points earned this month', () => {
    expect(calculateMonthlyServicePoints(0, 100)).toBe(100)
  })

  it('returns 0 when monthly cap already reached', () => {
    expect(calculateMonthlyServicePoints(500, 50)).toBe(0)
  })

  it('returns 0 when monthly cap exceeded', () => {
    expect(calculateMonthlyServicePoints(600, 50)).toBe(0)
  })

  it('returns reduced amount when partially remaining', () => {
    // 450 already earned, cap is 500, trying to award 100 → only 50 allowed
    expect(calculateMonthlyServicePoints(450, 100)).toBe(50)
  })

  it('returns full amount when under cap', () => {
    expect(calculateMonthlyServicePoints(200, 100)).toBe(100)
  })

  it('returns exactly remaining when new points equal remaining', () => {
    expect(calculateMonthlyServicePoints(400, 100)).toBe(100)
  })

  it('respects custom monthly cap', () => {
    expect(calculateMonthlyServicePoints(80, 50, 100)).toBe(20)
  })

  it('returns 0 for 0 new points', () => {
    expect(calculateMonthlyServicePoints(100, 0)).toBe(0)
  })
})

describe('service points constants', () => {
  it('SERVICE_POINTS_MONTHLY_CAP is 500', () => {
    expect(SERVICE_POINTS_MONTHLY_CAP).toBe(500)
  })

  it('POINTS_PER_HOUR is 10', () => {
    expect(POINTS_PER_HOUR).toBe(10)
  })

  it('POINTS_PER_HALF_HOUR is 5', () => {
    expect(POINTS_PER_HALF_HOUR).toBe(5)
  })
})
