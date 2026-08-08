import { useOnlineStatus } from '@/hooks/useOnlineStatus'

interface OfflineContentProps {
  /** Fallback message when content is unavailable offline */
  message?: string
  /** Optional children to render when online */
  children?: React.ReactNode
  /** Whether the content has been previously cached/loaded */
  isCached?: boolean
}

/**
 * Wrapper component that shows "content unavailable offline" when:
 * - The user is offline AND
 * - The content has not been previously loaded/cached
 *
 * Requirement 19.3: Display indication that content is unavailable offline
 * and requires a network connection.
 */
export function OfflineContent({
  message = 'This content is unavailable offline. Please connect to the internet to load it.',
  children,
  isCached = false,
}: OfflineContentProps) {
  const isOnline = useOnlineStatus()

  // If online or content is cached, render children normally
  if (isOnline || isCached) {
    return <>{children}</>
  }

  // Offline and content not cached — show unavailable message
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center p-8 text-center rounded-lg bg-muted/50 border border-border"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-12 w-12 text-muted-foreground mb-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <line x1="9" y1="10" x2="15" y2="10" />
      </svg>
      <p className="text-muted-foreground text-sm font-medium">{message}</p>
      <p className="text-muted-foreground/70 text-xs mt-2">
        Connect to the internet and try again.
      </p>
    </div>
  )
}

export default OfflineContent
