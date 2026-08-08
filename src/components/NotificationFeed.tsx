import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { useNotificationStore } from '@/stores/notifications'

/**
 * NotificationFeed — Reusable notification bell component for navigation.
 * Displays unread count badge and links to the full notifications page.
 *
 * Validates: Requirements 16.4
 */
export function NotificationBell() {
  const { user } = useAuthStore()
  const { unreadCount, subscribe, unsubscribe, fetchNotifications } =
    useNotificationStore()

  useEffect(() => {
    if (!user?.id) return

    fetchNotifications(user.id)
    subscribe(user.id)

    return () => {
      unsubscribe()
    }
  }, [user?.id, fetchNotifications, subscribe, unsubscribe])

  return (
    <Link
      to="/app/notifications"
      className="relative inline-flex items-center p-2 rounded-md text-foreground hover:bg-muted transition-colors"
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
    >
      <span aria-hidden="true" className="text-xl">🔔</span>
      {unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs font-bold text-white bg-destructive rounded-full"
          aria-hidden="true"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}

export default NotificationBell
