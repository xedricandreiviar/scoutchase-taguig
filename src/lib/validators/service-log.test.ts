import { describe, it, expect } from 'vitest'
import { validateServiceLog } from './service-log'
import type { ServiceLogInput } from './service-log'

function validInput(overrides: Partial<ServiceLogInput> = {}): ServiceLogInput {
  return {
    description: 'Helped clean up the riverside park area near the heritage site.',
    duration_hours: 2,
    date_performed: '2024-01-15',
    mission_id: 'abc-123-def',
    photo_proof: null,
    ...overrides,
  }
}

describe('validateServiceLog', () => {
  describe('valid inputs', () => {
    it('accepts a valid service log without photo', () => {
      const result = validateServiceLog(validInput())
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual({})
    })

    it('accepts minimum description length (20 chars)', () => {
      const result = validateServiceLog(validInput({ description: 'A'.repeat(20) }))
      expect(result.valid).toBe(true)
    })

    it('accepts maximum description length (500 chars)', () => {
      const result = validateServiceLog(validInput({ description: 'A'.repeat(500) }))
      expect(result.valid).toBe(true)
    })

    it('accepts minimum duration (0.5 hours)', () => {
      const result = validateServiceLog(validInput({ duration_hours: 0.5 }))
      expect(result.valid).toBe(true)
    })

    it('accepts maximum duration (24 hours)', () => {
      const result = validateServiceLog(validInput({ duration_hours: 24 }))
      expect(result.valid).toBe(true)
    })

    it('accepts valid 0.5 increments', () => {
      for (const d of [1, 1.5, 3, 5.5, 12, 23.5]) {
        const result = validateServiceLog(validInput({ duration_hours: d }))
        expect(result.valid).toBe(true)
      }
    })

    it('accepts a valid photo (JPEG)', () => {
      const photo = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
      Object.defineProperty(photo, 'size', { value: 1024 * 1024 }) // 1MB
      const result = validateServiceLog(validInput({ photo_proof: photo }))
      expect(result.valid).toBe(true)
    })

    it('accepts a valid photo (PNG)', () => {
      const photo = new File(['data'], 'photo.png', { type: 'image/png' })
      Object.defineProperty(photo, 'size', { value: 4 * 1024 * 1024 }) // 4MB
      const result = validateServiceLog(validInput({ photo_proof: photo }))
      expect(result.valid).toBe(true)
    })
  })

  describe('description validation', () => {
    it('rejects empty description', () => {
      const result = validateServiceLog(validInput({ description: '' }))
      expect(result.valid).toBe(false)
      expect(result.errors.description).toBeDefined()
    })

    it('rejects whitespace-only description', () => {
      const result = validateServiceLog(validInput({ description: '   ' }))
      expect(result.valid).toBe(false)
      expect(result.errors.description).toBeDefined()
    })

    it('rejects description shorter than 20 characters', () => {
      const result = validateServiceLog(validInput({ description: 'Too short' }))
      expect(result.valid).toBe(false)
      expect(result.errors.description).toContain('at least 20')
    })

    it('rejects description longer than 500 characters', () => {
      const result = validateServiceLog(validInput({ description: 'A'.repeat(501) }))
      expect(result.valid).toBe(false)
      expect(result.errors.description).toContain('500')
    })
  })

  describe('duration validation', () => {
    it('rejects duration below 0.5', () => {
      const result = validateServiceLog(validInput({ duration_hours: 0.25 }))
      expect(result.valid).toBe(false)
      expect(result.errors.duration_hours).toBeDefined()
    })

    it('rejects duration above 24', () => {
      const result = validateServiceLog(validInput({ duration_hours: 24.5 }))
      expect(result.valid).toBe(false)
      expect(result.errors.duration_hours).toBeDefined()
    })

    it('rejects duration not in 0.5 increments', () => {
      const result = validateServiceLog(validInput({ duration_hours: 2.3 }))
      expect(result.valid).toBe(false)
      expect(result.errors.duration_hours).toContain('0.5-hour increments')
    })

    it('rejects NaN duration', () => {
      const result = validateServiceLog(validInput({ duration_hours: NaN }))
      expect(result.valid).toBe(false)
      expect(result.errors.duration_hours).toBeDefined()
    })
  })

  describe('date validation', () => {
    it('rejects empty date', () => {
      const result = validateServiceLog(validInput({ date_performed: '' }))
      expect(result.valid).toBe(false)
      expect(result.errors.date_performed).toBeDefined()
    })

    it('rejects future date', () => {
      const future = new Date()
      future.setDate(future.getDate() + 1)
      const futureStr = future.toISOString().split('T')[0]
      const result = validateServiceLog(validInput({ date_performed: futureStr }))
      expect(result.valid).toBe(false)
      expect(result.errors.date_performed).toContain('future')
    })

    it('accepts today', () => {
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const result = validateServiceLog(validInput({ date_performed: todayStr }))
      expect(result.valid).toBe(true)
    })

    it('rejects invalid date format', () => {
      const result = validateServiceLog(validInput({ date_performed: '15-01-2024' }))
      expect(result.valid).toBe(false)
      expect(result.errors.date_performed).toBeDefined()
    })
  })

  describe('mission_id validation', () => {
    it('rejects empty mission_id', () => {
      const result = validateServiceLog(validInput({ mission_id: '' }))
      expect(result.valid).toBe(false)
      expect(result.errors.mission_id).toBeDefined()
    })

    it('rejects whitespace-only mission_id', () => {
      const result = validateServiceLog(validInput({ mission_id: '  ' }))
      expect(result.valid).toBe(false)
      expect(result.errors.mission_id).toBeDefined()
    })
  })

  describe('photo validation', () => {
    it('rejects non-JPEG/PNG file types', () => {
      const photo = new File(['data'], 'doc.pdf', { type: 'application/pdf' })
      Object.defineProperty(photo, 'size', { value: 1024 })
      const result = validateServiceLog(validInput({ photo_proof: photo }))
      expect(result.valid).toBe(false)
      expect(result.errors.photo_proof).toContain('JPEG or PNG')
    })

    it('rejects photo larger than 5MB', () => {
      const photo = new File(['data'], 'big.jpg', { type: 'image/jpeg' })
      Object.defineProperty(photo, 'size', { value: 6 * 1024 * 1024 })
      const result = validateServiceLog(validInput({ photo_proof: photo }))
      expect(result.valid).toBe(false)
      expect(result.errors.photo_proof).toContain('5MB')
    })

    it('accepts null photo (optional field)', () => {
      const result = validateServiceLog(validInput({ photo_proof: null }))
      expect(result.valid).toBe(true)
    })
  })

  describe('multiple errors', () => {
    it('returns all field errors at once', () => {
      const result = validateServiceLog({
        description: '',
        duration_hours: 100,
        date_performed: '',
        mission_id: '',
        photo_proof: null,
      })
      expect(result.valid).toBe(false)
      expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(4)
    })
  })
})
