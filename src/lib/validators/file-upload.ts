/**
 * File upload validation logic.
 * Requirements 4.5: Avatar — JPEG/PNG, max 2MB, max 512×512
 * Requirements 9.5: Challenge photo — JPEG/PNG, max 5MB, min 480×480
 * Requirements 10.2: Service proof — JPEG/PNG, max 5MB
 */

export type UploadContext = 'avatar' | 'challenge_photo' | 'service_proof'

export interface FileMetadata {
  type: string
  size: number // bytes
  width?: number
  height?: number
}

export interface FileUploadValidationResult {
  valid: boolean
  error?: string
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png']

const CONTEXT_CONSTRAINTS: Record<
  UploadContext,
  {
    maxSize: number
    maxSizeLabel: string
    maxWidth?: number
    maxHeight?: number
    minWidth?: number
    minHeight?: number
  }
> = {
  avatar: {
    maxSize: 2 * 1024 * 1024, // 2MB
    maxSizeLabel: '2MB',
    maxWidth: 512,
    maxHeight: 512,
  },
  challenge_photo: {
    maxSize: 5 * 1024 * 1024, // 5MB
    maxSizeLabel: '5MB',
    minWidth: 480,
    minHeight: 480,
  },
  service_proof: {
    maxSize: 5 * 1024 * 1024, // 5MB
    maxSizeLabel: '5MB',
  },
}

export function validateFileUpload(
  file: File | FileMetadata,
  context: UploadContext
): FileUploadValidationResult {
  const constraints = CONTEXT_CONSTRAINTS[context]

  // Extract metadata from File or FileMetadata
  const type = file instanceof File ? file.type : file.type
  const size = file instanceof File ? file.size : file.size

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(type)) {
    return {
      valid: false,
      error: 'File must be JPEG or PNG format',
    }
  }

  // Validate file size
  if (size > constraints.maxSize) {
    return {
      valid: false,
      error: `File size must not exceed ${constraints.maxSizeLabel}`,
    }
  }

  // Validate dimensions if available
  const metadata = file instanceof File ? undefined : file
  const width = metadata?.width
  const height = metadata?.height

  if (width !== undefined && height !== undefined) {
    // Check maximum dimensions (avatar)
    if (constraints.maxWidth && width > constraints.maxWidth) {
      return {
        valid: false,
        error: `Image width must not exceed ${constraints.maxWidth}px`,
      }
    }
    if (constraints.maxHeight && height > constraints.maxHeight) {
      return {
        valid: false,
        error: `Image height must not exceed ${constraints.maxHeight}px`,
      }
    }

    // Check minimum dimensions (challenge photo)
    if (constraints.minWidth && width < constraints.minWidth) {
      return {
        valid: false,
        error: `Image width must be at least ${constraints.minWidth}px`,
      }
    }
    if (constraints.minHeight && height < constraints.minHeight) {
      return {
        valid: false,
        error: `Image height must be at least ${constraints.minHeight}px`,
      }
    }
  }

  return { valid: true }
}

/**
 * Helper to get image dimensions from a File object.
 * Returns a promise that resolves with width and height.
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for dimension check'))
    }

    img.src = url
  })
}
