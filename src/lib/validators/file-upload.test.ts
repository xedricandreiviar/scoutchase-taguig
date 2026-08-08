import { describe, it, expect } from 'vitest'
import { validateFileUpload } from './file-upload'
import type { FileMetadata } from './file-upload'

describe('validateFileUpload', () => {
  describe('avatar context', () => {
    it('accepts a valid JPEG file within size and dimension limits', () => {
      const file: FileMetadata = {
        type: 'image/jpeg',
        size: 1 * 1024 * 1024, // 1MB
        width: 400,
        height: 400,
      }
      const result = validateFileUpload(file, 'avatar')
      expect(result.valid).toBe(true)
    })

    it('accepts a valid PNG file', () => {
      const file: FileMetadata = {
        type: 'image/png',
        size: 500 * 1024, // 500KB
        width: 512,
        height: 512,
      }
      const result = validateFileUpload(file, 'avatar')
      expect(result.valid).toBe(true)
    })

    it('rejects non-JPEG/PNG formats', () => {
      const file: FileMetadata = {
        type: 'image/gif',
        size: 100 * 1024,
        width: 200,
        height: 200,
      }
      const result = validateFileUpload(file, 'avatar')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('File must be JPEG or PNG format')
    })

    it('rejects files larger than 2MB', () => {
      const file: FileMetadata = {
        type: 'image/jpeg',
        size: 3 * 1024 * 1024, // 3MB
        width: 400,
        height: 400,
      }
      const result = validateFileUpload(file, 'avatar')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('File size must not exceed 2MB')
    })

    it('rejects images wider than 512px', () => {
      const file: FileMetadata = {
        type: 'image/png',
        size: 1 * 1024 * 1024,
        width: 600,
        height: 400,
      }
      const result = validateFileUpload(file, 'avatar')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Image width must not exceed 512px')
    })

    it('rejects images taller than 512px', () => {
      const file: FileMetadata = {
        type: 'image/png',
        size: 1 * 1024 * 1024,
        width: 400,
        height: 600,
      }
      const result = validateFileUpload(file, 'avatar')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Image height must not exceed 512px')
    })

    it('accepts file at exact size limit (2MB)', () => {
      const file: FileMetadata = {
        type: 'image/jpeg',
        size: 2 * 1024 * 1024,
        width: 512,
        height: 512,
      }
      const result = validateFileUpload(file, 'avatar')
      expect(result.valid).toBe(true)
    })

    it('accepts file without dimensions (validation passes without dimension check)', () => {
      const file: FileMetadata = {
        type: 'image/jpeg',
        size: 1 * 1024 * 1024,
      }
      const result = validateFileUpload(file, 'avatar')
      expect(result.valid).toBe(true)
    })
  })

  describe('challenge_photo context', () => {
    it('accepts a valid challenge photo', () => {
      const file: FileMetadata = {
        type: 'image/jpeg',
        size: 4 * 1024 * 1024,
        width: 1920,
        height: 1080,
      }
      const result = validateFileUpload(file, 'challenge_photo')
      expect(result.valid).toBe(true)
    })

    it('rejects photos smaller than 480×480', () => {
      const file: FileMetadata = {
        type: 'image/jpeg',
        size: 1 * 1024 * 1024,
        width: 320,
        height: 320,
      }
      const result = validateFileUpload(file, 'challenge_photo')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Image width must be at least 480px')
    })

    it('rejects photos larger than 5MB', () => {
      const file: FileMetadata = {
        type: 'image/png',
        size: 6 * 1024 * 1024,
        width: 1920,
        height: 1080,
      }
      const result = validateFileUpload(file, 'challenge_photo')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('File size must not exceed 5MB')
    })
  })

  describe('service_proof context', () => {
    it('accepts a valid service proof', () => {
      const file: FileMetadata = {
        type: 'image/png',
        size: 3 * 1024 * 1024,
      }
      const result = validateFileUpload(file, 'service_proof')
      expect(result.valid).toBe(true)
    })

    it('rejects files larger than 5MB', () => {
      const file: FileMetadata = {
        type: 'image/jpeg',
        size: 6 * 1024 * 1024,
      }
      const result = validateFileUpload(file, 'service_proof')
      expect(result.valid).toBe(false)
      expect(result.error).toBe('File size must not exceed 5MB')
    })

    it('has no dimension requirements', () => {
      const file: FileMetadata = {
        type: 'image/jpeg',
        size: 1 * 1024 * 1024,
        width: 100,
        height: 100,
      }
      const result = validateFileUpload(file, 'service_proof')
      expect(result.valid).toBe(true)
    })
  })
})
