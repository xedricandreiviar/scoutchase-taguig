import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OfflineContent } from './OfflineContent'

describe('OfflineContent', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
  })

  it('renders children when online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    render(
      <OfflineContent>
        <p>Heritage content here</p>
      </OfflineContent>
    )
    expect(screen.getByText('Heritage content here')).toBeInTheDocument()
  })

  it('renders children when offline but content is cached', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    render(
      <OfflineContent isCached={true}>
        <p>Cached content</p>
      </OfflineContent>
    )
    expect(screen.getByText('Cached content')).toBeInTheDocument()
  })

  it('shows unavailable message when offline and content not cached', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    render(
      <OfflineContent isCached={false}>
        <p>This should not be shown</p>
      </OfflineContent>
    )
    expect(screen.queryByText('This should not be shown')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByText(/unavailable offline/i)
    ).toBeInTheDocument()
  })

  it('shows custom message when provided', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    render(
      <OfflineContent message="Site data not loaded yet">
        <p>Content</p>
      </OfflineContent>
    )
    expect(screen.getByText('Site data not loaded yet')).toBeInTheDocument()
  })

  it('defaults isCached to false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    render(
      <OfflineContent>
        <p>Hidden content</p>
      </OfflineContent>
    )
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
