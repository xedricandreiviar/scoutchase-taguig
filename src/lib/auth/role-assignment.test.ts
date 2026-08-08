import { describe, it, expect } from 'vitest'
import { assignRole, requiresGuardianEmail } from './role-assignment'

describe('assignRole', () => {
  // Req 1.2: "Not a Scout yet" → Guest
  describe('Not a Scout yet', () => {
    it('assigns Guest role', () => {
      const result = assignRole('Not a Scout yet')
      expect(result.role).toBe('Guest')
      expect(result.message).toBeUndefined()
    })

    it('assigns Guest even if troop is provided', () => {
      const result = assignRole('Not a Scout yet', 'Troop42')
      expect(result.role).toBe('Guest')
    })
  })

  // Req 1.4: "Adult Leader" → Adult_Leader
  describe('Adult Leader', () => {
    it('assigns Adult_Leader role without troop', () => {
      const result = assignRole('Adult Leader')
      expect(result.role).toBe('Adult_Leader')
      expect(result.message).toBeUndefined()
    })

    it('assigns Adult_Leader role even with troop', () => {
      const result = assignRole('Adult Leader', 'Unit7')
      expect(result.role).toBe('Adult_Leader')
      expect(result.message).toBeUndefined()
    })
  })

  // Req 1.3: Scout section + valid troop → corresponding scout role
  describe('Scout sections with troop', () => {
    it('Cub Scout + troop → Cub_Scout', () => {
      const result = assignRole('Cub Scout', 'Pack1')
      expect(result.role).toBe('Cub_Scout')
      expect(result.message).toBeUndefined()
    })

    it('Boy Scout + troop → Boy_Scout', () => {
      const result = assignRole('Boy Scout', 'Troop42')
      expect(result.role).toBe('Boy_Scout')
      expect(result.message).toBeUndefined()
    })

    it('Senior Scout + troop → Senior_Scout', () => {
      const result = assignRole('Senior Scout', 'Outfit3')
      expect(result.role).toBe('Senior_Scout')
      expect(result.message).toBeUndefined()
    })

    it('Rover Scout + troop → Rover_Scout', () => {
      const result = assignRole('Rover Scout', 'Crew5')
      expect(result.role).toBe('Rover_Scout')
      expect(result.message).toBeUndefined()
    })
  })

  // Req 1.5: Scout section WITHOUT troop → Guest with message
  describe('Scout sections without troop', () => {
    it('Cub Scout without troop → Guest with message', () => {
      const result = assignRole('Cub Scout')
      expect(result.role).toBe('Guest')
      expect(result.message).toBeDefined()
      expect(result.message).toContain('troop/unit number is required')
    })

    it('Boy Scout with empty string troop → Guest with message', () => {
      const result = assignRole('Boy Scout', '')
      expect(result.role).toBe('Guest')
      expect(result.message).toBeDefined()
    })

    it('Senior Scout with whitespace-only troop → Guest with message', () => {
      const result = assignRole('Senior Scout', '   ')
      expect(result.role).toBe('Guest')
      expect(result.message).toBeDefined()
    })

    it('Rover Scout with undefined troop → Guest with message', () => {
      const result = assignRole('Rover Scout', undefined)
      expect(result.role).toBe('Guest')
      expect(result.message).toContain('troop/unit number is required')
    })
  })

  // Edge case: unknown section
  describe('unknown section', () => {
    it('assigns Guest for unrecognized section', () => {
      const result = assignRole('Unknown Section')
      expect(result.role).toBe('Guest')
    })
  })
})

describe('requiresGuardianEmail', () => {
  it('returns true for age 7 (under 12)', () => {
    expect(requiresGuardianEmail(7)).toBe(true)
  })

  it('returns true for age 11 (under 12)', () => {
    expect(requiresGuardianEmail(11)).toBe(true)
  })

  it('returns false for age 12 (boundary)', () => {
    expect(requiresGuardianEmail(12)).toBe(false)
  })

  it('returns false for age 15', () => {
    expect(requiresGuardianEmail(15)).toBe(false)
  })

  it('returns false for age 99', () => {
    expect(requiresGuardianEmail(99)).toBe(false)
  })
})
