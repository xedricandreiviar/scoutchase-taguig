import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CapacityError, isCapacityError, parseRetryAfter } from './CapacityError'

describe('CapacityError component', () => {
  it('renders 429 error with appropriate message', () => {
    render(<CapacityError statusCode={429} onRetry={() => {}} />)

    expect(screen.getByText('Too many requests')).toBeTruthy()
    expect(
      screen.getByText(/experiencing high demand/)
    ).toBeTruthy()
  })

  it('renders 503 error with appropriate message', () => {
    render(<CapacityError statusCode={503} onRetry={() => {}} />)

    expect(screen.getByText('Service temporarily unavailable')).toBeTruthy()
    expect(
      screen.getByText(/currently at capacity/)
    ).toBeTruthy()
  })

  it('shows countdown when retryAfterSeconds is provided', () => {
    render(
      <CapacityError statusCode={429} retryAfterSeconds={30} onRetry={() => {}} />
    )

    expect(screen.getByText('30s')).toBeTruthy()
  })

  it('disables retry button during countdown', () => {
    render(
      <CapacityError statusCode={429} retryAfterSeconds={10} onRetry={() => {}} />
    )

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('enables retry button when no countdown', () => {
    render(<CapacityError statusCode={503} onRetry={() => {}} />)

    const button = screen.getByRole('button')
    expect(button).not.toBeDisabled()
  })

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn()
    render(<CapacityError statusCode={503} onRetry={onRetry} />)

    fireEvent.click(screen.getByRole('button'))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('has accessible alert role', () => {
    render(<CapacityError statusCode={429} onRetry={() => {}} />)

    expect(screen.getByRole('alert')).toBeTruthy()
  })
})

describe('isCapacityError', () => {
  it('returns 429 for status 429', () => {
    expect(isCapacityError(429)).toBe(429)
  })

  it('returns 503 for status 503', () => {
    expect(isCapacityError(503)).toBe(503)
  })

  it('returns null for other status codes', () => {
    expect(isCapacityError(200)).toBeNull()
    expect(isCapacityError(400)).toBeNull()
    expect(isCapacityError(401)).toBeNull()
    expect(isCapacityError(500)).toBeNull()
  })
})

describe('parseRetryAfter', () => {
  it('parses integer seconds from Headers', () => {
    const headers = new Headers({ 'Retry-After': '60' })
    expect(parseRetryAfter(headers)).toBe(60)
  })

  it('parses integer seconds from plain object', () => {
    expect(parseRetryAfter({ 'Retry-After': '30' })).toBe(30)
  })

  it('handles lowercase header key in plain object', () => {
    expect(parseRetryAfter({ 'retry-after': '15' })).toBe(15)
  })

  it('returns undefined when header is missing', () => {
    const headers = new Headers()
    expect(parseRetryAfter(headers)).toBeUndefined()
  })

  it('returns undefined for zero or negative values', () => {
    expect(parseRetryAfter({ 'Retry-After': '0' })).toBeUndefined()
    expect(parseRetryAfter({ 'Retry-After': '-5' })).toBeUndefined()
  })

  it('parses HTTP-date format', () => {
    const futureDate = new Date(Date.now() + 60_000).toUTCString()
    const result = parseRetryAfter({ 'Retry-After': futureDate })
    // Should be approximately 60 seconds (allow some tolerance)
    expect(result).toBeGreaterThan(55)
    expect(result).toBeLessThanOrEqual(61)
  })

  it('returns undefined for past HTTP-date', () => {
    const pastDate = new Date(Date.now() - 60_000).toUTCString()
    expect(parseRetryAfter({ 'Retry-After': pastDate })).toBeUndefined()
  })
})
