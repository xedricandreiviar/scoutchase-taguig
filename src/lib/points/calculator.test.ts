import { describe, it, expect } from 'vitest'
import {
  calculateTotalPoints,
  POINTS_PER_CHALLENGE,
  POINTS_PER_TRAIL,
  POINTS_PER_EVENT,
} from './calculator'

describe('calculateTotalPoints', () => {
  it('returns 0 when all activities are 0', () => {
    expect(
      calculateTotalPoints({ challenges: 0, servicePoints: 0, trails: 0, events: 0 })
    ).toBe(0)
  })

  it('calculates points for challenges only (50 each)', () => {
    expect(
      calculateTotalPoints({ challenges: 3, servicePoints: 0, trails: 0, events: 0 })
    ).toBe(3 * POINTS_PER_CHALLENGE)
  })

  it('calculates points for trails only (100 each)', () => {
    expect(
      calculateTotalPoints({ challenges: 0, servicePoints: 0, trails: 2, events: 0 })
    ).toBe(2 * POINTS_PER_TRAIL)
  })

  it('calculates points for events only (25 each)', () => {
    expect(
      calculateTotalPoints({ challenges: 0, servicePoints: 0, trails: 0, events: 4 })
    ).toBe(4 * POINTS_PER_EVENT)
  })

  it('passes through service points directly', () => {
    expect(
      calculateTotalPoints({ challenges: 0, servicePoints: 250, trails: 0, events: 0 })
    ).toBe(250)
  })

  it('sums all activity types correctly', () => {
    const result = calculateTotalPoints({
      challenges: 5,
      servicePoints: 300,
      trails: 2,
      events: 10,
    })
    // 5×50 + 300 + 2×100 + 10×25 = 250 + 300 + 200 + 250 = 1000
    expect(result).toBe(1000)
  })

  it('handles large numbers', () => {
    const result = calculateTotalPoints({
      challenges: 100,
      servicePoints: 500,
      trails: 50,
      events: 200,
    })
    // 100×50 + 500 + 50×100 + 200×25 = 5000 + 500 + 5000 + 5000 = 15500
    expect(result).toBe(15500)
  })
})

describe('point constants', () => {
  it('POINTS_PER_CHALLENGE is 50', () => {
    expect(POINTS_PER_CHALLENGE).toBe(50)
  })

  it('POINTS_PER_TRAIL is 100', () => {
    expect(POINTS_PER_TRAIL).toBe(100)
  })

  it('POINTS_PER_EVENT is 25', () => {
    expect(POINTS_PER_EVENT).toBe(25)
  })
})
