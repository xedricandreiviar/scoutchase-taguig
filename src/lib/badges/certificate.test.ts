/**
 * Unit tests for the certificate generation client-side service.
 *
 * Validates: Requirements 11.3, 11.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateCertificate, downloadCertificate } from './certificate'

// Mock supabase
vi.mock('../supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

import { supabase } from '../supabase'

const mockInvoke = vi.mocked(supabase.functions.invoke)

describe('generateCertificate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns certificate URL on successful generation', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        certificate_url: 'https://storage.example.com/certificates/user1/badge1.svg',
        already_generated: false,
      },
      error: null,
    })

    const result = await generateCertificate('user-123', 'badge-456')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.certificate_url).toBe('https://storage.example.com/certificates/user1/badge1.svg')
      expect(result.already_generated).toBe(false)
    }

    expect(mockInvoke).toHaveBeenCalledWith('generate-certificate', {
      body: { user_id: 'user-123', badge_id: 'badge-456' },
    })
  })

  it('returns existing certificate URL when already generated', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        certificate_url: 'https://storage.example.com/certificates/user1/badge1.svg',
        already_generated: true,
      },
      error: null,
    })

    const result = await generateCertificate('user-123', 'badge-456')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.already_generated).toBe(true)
    }
  })

  it('returns retryable error on network failure (Req 11.6)', async () => {
    mockInvoke.mockRejectedValue(new Error('Network error'))

    const result = await generateCertificate('user-123', 'badge-456')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.retryable).toBe(true)
      expect(result.error).toBe('network_error')
      expect(result.message).toContain('check your connection')
    }
  })

  it('returns retryable error on Edge Function invocation error (Req 11.6)', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Function failed' },
    })

    const result = await generateCertificate('user-123', 'badge-456')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.retryable).toBe(true)
      expect(result.error).toBe('certificate_generation_failed')
    }
  })

  it('returns retryable error when generation fails server-side', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        error: 'certificate_generation_failed',
        message: 'Failed to store the certificate. Please retry.',
      },
      error: null,
    })

    const result = await generateCertificate('user-123', 'badge-456')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.retryable).toBe(true)
      expect(result.error).toBe('certificate_generation_failed')
    }
  })

  it('returns non-retryable error when badge not earned', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'badge_not_earned' },
      error: null,
    })

    const result = await generateCertificate('user-123', 'badge-456')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.retryable).toBe(false)
      expect(result.error).toBe('badge_not_earned')
    }
  })

  it('returns non-retryable error when user not found', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'user_not_found' },
      error: null,
    })

    const result = await generateCertificate('user-123', 'badge-456')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.retryable).toBe(false)
      expect(result.error).toBe('user_not_found')
    }
  })
})

describe('downloadCertificate', () => {
  it('creates a download link and triggers click', () => {
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node)

    downloadCertificate('https://storage.example.com/cert.svg', 'my-cert.svg')

    expect(appendChildSpy).toHaveBeenCalled()
    const link = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement
    expect(link.href).toBe('https://storage.example.com/cert.svg')
    expect(link.download).toBe('my-cert.svg')
    expect(link.target).toBe('_blank')
    expect(removeChildSpy).toHaveBeenCalled()

    appendChildSpy.mockRestore()
    removeChildSpy.mockRestore()
  })

  it('uses default filename when none provided', () => {
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node)

    downloadCertificate('https://storage.example.com/cert.svg')

    const link = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement
    expect(link.download).toBe('scoutchase-certificate.svg')

    appendChildSpy.mockRestore()
    removeChildSpy.mockRestore()
  })
})
