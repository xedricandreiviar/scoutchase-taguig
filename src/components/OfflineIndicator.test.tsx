import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { OfflineIndicator } from './OfflineIndicator'

describe('OfflineIndicator', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
  })

  it('does not render when online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    const { container } = render(<OfflineIndicator />)
    expect(container.firstChild).toBeNull()
  })

  it('renders offline banner when offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    render(<OfflineIndicator />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/you are offline/i)).toBeInTheDocument()
  })

  it('shows banner when going offline and hides when coming back online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    const { container } = render(<OfflineIndicator />)
    expect(container.firstChild).toBeNull()

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(container.firstChild).toBeNull()
  })

  it('has aria-live assertive for accessibility', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    render(<OfflineIndicator />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'assertive')
  })
})
