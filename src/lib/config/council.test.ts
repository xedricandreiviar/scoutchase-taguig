import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isValidHexColor } from './council'

describe('council config', () => {
  describe('isValidHexColor', () => {
    it('accepts valid 6-digit hex color', () => {
      expect(isValidHexColor('#1B5E20')).toBe(true)
      expect(isValidHexColor('#FFD700')).toBe(true)
      expect(isValidHexColor('#000000')).toBe(true)
      expect(isValidHexColor('#ffffff')).toBe(true)
    })

    it('accepts valid 3-digit hex color', () => {
      expect(isValidHexColor('#FFF')).toBe(true)
      expect(isValidHexColor('#abc')).toBe(true)
      expect(isValidHexColor('#123')).toBe(true)
    })

    it('rejects invalid colors', () => {
      expect(isValidHexColor('')).toBe(false)
      expect(isValidHexColor('red')).toBe(false)
      expect(isValidHexColor('#GGG')).toBe(false)
      expect(isValidHexColor('#12345')).toBe(false)
      expect(isValidHexColor('1B5E20')).toBe(false)
      expect(isValidHexColor('#1B5E20FF')).toBe(false)
      expect(isValidHexColor('rgb(0,0,0)')).toBe(false)
    })
  })

  describe('getCouncilConfig', () => {
    const originalEnv = { ...import.meta.env }

    beforeEach(() => {
      // Reset env to defaults
      vi.stubEnv('VITE_COUNCIL_NAME', '')
      vi.stubEnv('VITE_COUNCIL_LOGO_URL', '')
      vi.stubEnv('VITE_COUNCIL_PRIMARY_COLOR', '')
      vi.stubEnv('VITE_COUNCIL_SECONDARY_COLOR', '')
      vi.stubEnv('VITE_COUNCIL_ID', '')
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('returns default Taguig config when env vars are empty', async () => {
      // Dynamic import to pick up stubbed env
      const { getCouncilConfig } = await import('./council')
      const config = getCouncilConfig()

      expect(config.name).toBe('BSP Taguig City Council')
      expect(config.primaryColor).toBe('#1B5E20')
      expect(config.secondaryColor).toBe('#FFD700')
      expect(config.councilId).toBe('taguig-city')
    })

    it('uses environment variable overrides when set', async () => {
      vi.stubEnv('VITE_COUNCIL_NAME', 'BSP Manila Council')
      vi.stubEnv('VITE_COUNCIL_LOGO_URL', '/manila-logo.png')
      vi.stubEnv('VITE_COUNCIL_PRIMARY_COLOR', '#0000FF')
      vi.stubEnv('VITE_COUNCIL_SECONDARY_COLOR', '#FF0000')
      vi.stubEnv('VITE_COUNCIL_ID', 'manila-city')

      const { getCouncilConfig } = await import('./council')
      const config = getCouncilConfig()

      expect(config.name).toBe('BSP Manila Council')
      expect(config.logoUrl).toBe('/manila-logo.png')
      expect(config.primaryColor).toBe('#0000FF')
      expect(config.secondaryColor).toBe('#FF0000')
      expect(config.councilId).toBe('manila-city')
    })
  })
})
