import { useEffect, useRef, useCallback } from 'react'
import { createFocusTrap } from '@/lib/a11y/focus-trap'

/**
 * React hook that creates a focus trap for modal dialogs.
 * Ensures keyboard navigation stays within the dialog and
 * Escape key triggers the onClose callback.
 *
 * Requirement 20.3: Keyboard navigation with no keyboard traps
 *
 * @param isOpen - Whether the dialog/modal is currently open
 * @param onClose - Callback to close the dialog (triggered on Escape)
 * @returns ref to attach to the dialog container element
 *
 * @example
 * ```tsx
 * function MyModal({ isOpen, onClose }) {
 *   const dialogRef = useFocusTrap(isOpen, onClose)
 *   if (!isOpen) return null
 *   return (
 *     <div ref={dialogRef} role="dialog" aria-modal="true">
 *       <button onClick={onClose}>Close</button>
 *       ...
 *     </div>
 *   )
 * }
 * ```
 */
export function useFocusTrap(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const handleEscape = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen || !containerRef.current) {
      // Clean up if closing
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
      return
    }

    // Small delay to ensure the DOM is rendered
    const timeoutId = setTimeout(() => {
      if (containerRef.current) {
        cleanupRef.current = createFocusTrap(containerRef.current, {
          onEscape: handleEscape,
        })
      }
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [isOpen, handleEscape])

  return containerRef
}

export default useFocusTrap
