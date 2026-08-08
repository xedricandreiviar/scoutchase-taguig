import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validateFileUpload } from './file-upload'
import type { FileMetadata, UploadContext } from './file-upload'

/**
 * Property 11: File upload validation
 *
 * For any file metadata (MIME type, file size in bytes, and dimensions in pixels), the upload
 * validator SHALL accept the file if and only if the type is in the allowed set (JPEG or PNG),
 * size does not exceed the configured limit (2MB for avatars, 5MB for challenge photos and
 * service log proofs), and dimensions meet requirements where specified (512×512 max for avatars,
 * 480×480 min for challenge photos).
 *
 * **Validates: Requirements 4.5, 9.5, 9.6, 21.4**
 */
describe('Property 11: File upload validation', () => {
  // --- Constants ---
  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png']
  const AVATAR_MAX_SIZE = 2 * 1024 * 1024 // 2MB
  const CHALLENGE_MAX_SIZE = 5 * 1024 * 1024 // 5MB
  const SERVICE_MAX_SIZE = 5 * 1024 * 1024 // 5MB
  const AVATAR_MAX_DIM = 512
  const CHALLENGE_MIN_DIM = 480

  // --- Generators ---

  /** Generate a valid MIME type (JPEG or PNG) */
  const validMimeType = fc.constantFrom('image/jpeg', 'image/png')

  /** Generate an invalid MIME type */
  const invalidMimeType = fc.constantFrom(
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'video/mp4',
    'image/bmp',
    'image/tiff'
  )

  /** Generate a file size within a limit */
  const sizeWithinLimit = (maxSize: number) =>
    fc.integer({ min: 1, max: maxSize })

  /** Generate a file size exceeding a limit */
  const sizeExceedingLimit = (maxSize: number) =>
    fc.integer({ min: maxSize + 1, max: maxSize * 3 })

  /** Generate dimensions within avatar max (1 to 512) */
  const avatarValidDimension = fc.integer({ min: 1, max: AVATAR_MAX_DIM })

  /** Generate dimensions exceeding avatar max (> 512) */
  const avatarInvalidDimension = fc.integer({ min: AVATAR_MAX_DIM + 1, max: 4096 })

  /** Generate dimensions meeting challenge photo min (>= 480) */
  const challengeValidDimension = fc.integer({ min: CHALLENGE_MIN_DIM, max: 4096 })

  /** Generate dimensions below challenge photo min (< 480) */
  const challengeInvalidDimension = fc.integer({ min: 1, max: CHALLENGE_MIN_DIM - 1 })

  /** Generate arbitrary positive dimensions */
  const anyDimension = fc.integer({ min: 1, max: 8192 })

  // --- Oracle function: expected acceptance for given context ---

  function shouldAccept(
    mimeType: string,
    size: number,
    context: UploadContext,
    width?: number,
    height?: number
  ): boolean {
    // Must be allowed MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) return false

    // Size limits by context
    const maxSize =
      context === 'avatar' ? AVATAR_MAX_SIZE :
      context === 'challenge_photo' ? CHALLENGE_MAX_SIZE :
      SERVICE_MAX_SIZE

    if (size > maxSize) return false

    // Dimension checks only apply when dimensions are provided
    if (width !== undefined && height !== undefined) {
      if (context === 'avatar') {
        if (width > AVATAR_MAX_DIM || height > AVATAR_MAX_DIM) return false
      }
      if (context === 'challenge_photo') {
        if (width < CHALLENGE_MIN_DIM || height < CHALLENGE_MIN_DIM) return false
      }
      // service_proof has no dimension requirements
    }

    return true
  }

  // --- Properties ---

  describe('avatar context', () => {
    it('accepts valid files (correct MIME, within size, within dimensions)', () => {
      fc.assert(
        fc.property(
          validMimeType,
          sizeWithinLimit(AVATAR_MAX_SIZE),
          avatarValidDimension,
          avatarValidDimension,
          (mimeType, size, width, height) => {
            const file: FileMetadata = { type: mimeType, size, width, height }
            const result = validateFileUpload(file, 'avatar')
            expect(result.valid).toBe(true)
          }
        ),
        { numRuns: 200 }
      )
    })

    it('rejects files with invalid MIME type', () => {
      fc.assert(
        fc.property(
          invalidMimeType,
          sizeWithinLimit(AVATAR_MAX_SIZE),
          avatarValidDimension,
          avatarValidDimension,
          (mimeType, size, width, height) => {
            const file: FileMetadata = { type: mimeType, size, width, height }
            const result = validateFileUpload(file, 'avatar')
            expect(result.valid).toBe(false)
          }
        ),
        { numRuns: 200 }
      )
    })

    it('rejects files exceeding 2MB size limit', () => {
      fc.assert(
        fc.property(
          validMimeType,
          sizeExceedingLimit(AVATAR_MAX_SIZE),
          avatarValidDimension,
          avatarValidDimension,
          (mimeType, size, width, height) => {
            const file: FileMetadata = { type: mimeType, size, width, height }
            const result = validateFileUpload(file, 'avatar')
            expect(result.valid).toBe(false)
          }
        ),
        { numRuns: 200 }
      )
    })

    it('rejects files with dimensions exceeding 512px', () => {
      fc.assert(
        fc.property(
          validMimeType,
          sizeWithinLimit(AVATAR_MAX_SIZE),
          fc.oneof(
            // width too large
            fc.tuple(avatarInvalidDimension, avatarValidDimension),
            // height too large
            fc.tuple(avatarValidDimension, avatarInvalidDimension),
            // both too large
            fc.tuple(avatarInvalidDimension, avatarInvalidDimension)
          ),
          (mimeType, size, [width, height]) => {
            const file: FileMetadata = { type: mimeType, size, width, height }
            const result = validateFileUpload(file, 'avatar')
            expect(result.valid).toBe(false)
          }
        ),
        { numRuns: 200 }
      )
    })
  })

  describe('challenge_photo context', () => {
    it('accepts valid files (correct MIME, within size, meets min dimensions)', () => {
      fc.assert(
        fc.property(
          validMimeType,
          sizeWithinLimit(CHALLENGE_MAX_SIZE),
          challengeValidDimension,
          challengeValidDimension,
          (mimeType, size, width, height) => {
            const file: FileMetadata = { type: mimeType, size, width, height }
            const result = validateFileUpload(file, 'challenge_photo')
            expect(result.valid).toBe(true)
          }
        ),
        { numRuns: 200 }
      )
    })

    it('rejects files with invalid MIME type', () => {
      fc.assert(
        fc.property(
          invalidMimeType,
          sizeWithinLimit(CHALLENGE_MAX_SIZE),
          challengeValidDimension,
          challengeValidDimension,
          (mimeType, size, width, height) => {
            const file: FileMetadata = { type: mimeType, size, width, height }
            const result = validateFileUpload(file, 'challenge_photo')
            expect(result.valid).toBe(false)
          }
        ),
        { numRuns: 200 }
      )
    })

    it('rejects files exceeding 5MB size limit', () => {
      fc.assert(
        fc.property(
          validMimeType,
          sizeExceedingLimit(CHALLENGE_MAX_SIZE),
          challengeValidDimension,
          challengeValidDimension,
          (mimeType, size, width, height) => {
            const file: FileMetadata = { type: mimeType, size, width, height }
            const result = validateFileUpload(file, 'challenge_photo')
            expect(result.valid).toBe(false)
          }
        ),
        { numRuns: 200 }
      )
    })

    it('rejects files with dimensions below 480px minimum', () => {
      fc.assert(
        fc.property(
          validMimeType,
          sizeWithinLimit(CHALLENGE_MAX_SIZE),
          fc.oneof(
            // width too small
            fc.tuple(challengeInvalidDimension, challengeValidDimension),
            // height too small
            fc.tuple(challengeValidDimension, challengeInvalidDimension),
            // both too small
            fc.tuple(challengeInvalidDimension, challengeInvalidDimension)
          ),
          (mimeType, size, [width, height]) => {
            const file: FileMetadata = { type: mimeType, size, width, height }
            const result = validateFileUpload(file, 'challenge_photo')
            expect(result.valid).toBe(false)
          }
        ),
        { numRuns: 200 }
      )
    })
  })

  describe('service_proof context', () => {
    it('accepts valid files (correct MIME, within size, any dimensions)', () => {
      fc.assert(
        fc.property(
          validMimeType,
          sizeWithinLimit(SERVICE_MAX_SIZE),
          anyDimension,
          anyDimension,
          (mimeType, size, width, height) => {
            const file: FileMetadata = { type: mimeType, size, width, height }
            const result = validateFileUpload(file, 'service_proof')
            expect(result.valid).toBe(true)
          }
        ),
        { numRuns: 200 }
      )
    })

    it('rejects files with invalid MIME type', () => {
      fc.assert(
        fc.property(
          invalidMimeType,
          sizeWithinLimit(SERVICE_MAX_SIZE),
          anyDimension,
          anyDimension,
          (mimeType, size, width, height) => {
            const file: FileMetadata = { type: mimeType, size, width, height }
            const result = validateFileUpload(file, 'service_proof')
            expect(result.valid).toBe(false)
          }
        ),
        { numRuns: 200 }
      )
    })

    it('rejects files exceeding 5MB size limit', () => {
      fc.assert(
        fc.property(
          validMimeType,
          sizeExceedingLimit(SERVICE_MAX_SIZE),
          anyDimension,
          anyDimension,
          (mimeType, size, width, height) => {
            const file: FileMetadata = { type: mimeType, size, width, height }
            const result = validateFileUpload(file, 'service_proof')
            expect(result.valid).toBe(false)
          }
        ),
        { numRuns: 200 }
      )
    })

    it('has no dimension requirements (any dimensions accepted)', () => {
      fc.assert(
        fc.property(
          validMimeType,
          sizeWithinLimit(SERVICE_MAX_SIZE),
          fc.integer({ min: 1, max: 10 }), // very small dimensions
          fc.integer({ min: 1, max: 10 }),
          (mimeType, size, width, height) => {
            const file: FileMetadata = { type: mimeType, size, width, height }
            const result = validateFileUpload(file, 'service_proof')
            expect(result.valid).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('cross-context oracle property', () => {
    it('validator result matches oracle for arbitrary file metadata across all contexts', () => {
      const contextArb = fc.constantFrom<UploadContext>('avatar', 'challenge_photo', 'service_proof')
      const mimeArb = fc.oneof(validMimeType, invalidMimeType)
      const sizeArb = fc.integer({ min: 1, max: 10 * 1024 * 1024 }) // up to 10MB
      const optionalDimension = fc.option(anyDimension, { nil: undefined })

      fc.assert(
        fc.property(
          contextArb,
          mimeArb,
          sizeArb,
          optionalDimension,
          optionalDimension,
          (context, mimeType, size, width, height) => {
            const file: FileMetadata = { type: mimeType, size, width, height }
            const result = validateFileUpload(file, context)
            const expected = shouldAccept(mimeType, size, context, width, height)

            expect(result.valid).toBe(expected)
          }
        ),
        { numRuns: 500 }
      )
    })
  })
})
