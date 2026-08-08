/**
 * Focus trap utility for modal dialogs and overlays.
 * Prevents keyboard traps by ensuring:
 * - Focus stays within the dialog while open
 * - Escape key closes the dialog
 * - Focus returns to the triggering element on close
 *
 * Requirement 20.3: Keyboard navigation with no keyboard traps
 */

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ')

/**
 * Returns all focusable elements within a container.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
    (el) => {
      if (el.hasAttribute('disabled')) return false
      // Check visibility: hidden elements via display:none have no offsetParent,
      // but in JSDOM offsetParent is always null, so we also check getComputedStyle
      const style = window.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') return false
      return true
    }
  )
}

/**
 * Creates a focus trap within a container element.
 * Returns a cleanup function to remove event listeners and restore focus.
 */
export function createFocusTrap(
  container: HTMLElement,
  options: {
    onEscape?: () => void
    initialFocus?: HTMLElement | null
    returnFocusTo?: HTMLElement | null
  } = {}
): () => void {
  const { onEscape, initialFocus, returnFocusTo } = options
  const previouslyFocused = returnFocusTo || (document.activeElement as HTMLElement)

  // Focus the initial element or first focusable element
  const focusableElements = getFocusableElements(container)
  if (initialFocus) {
    initialFocus.focus()
  } else if (focusableElements.length > 0) {
    focusableElements[0].focus()
  } else {
    // If no focusable elements, make the container itself focusable
    container.setAttribute('tabindex', '-1')
    container.focus()
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onEscape?.()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const focusable = getFocusableElements(container)
    if (focusable.length === 0) {
      event.preventDefault()
      return
    }

    const firstElement = focusable[0]
    const lastElement = focusable[focusable.length - 1]

    if (event.shiftKey) {
      // Shift+Tab: if at first element, wrap to last
      if (document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      // Tab: if at last element, wrap to first
      if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown)

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown)
    // Return focus to previously focused element
    if (previouslyFocused && previouslyFocused.focus) {
      previouslyFocused.focus()
    }
  }
}
