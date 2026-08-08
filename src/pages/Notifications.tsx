import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import {
  useNotificationStore,
  type Notification,
  type NotificationType,
} from '@/stores/notifications'

/**
 * Notifications page — Shows the most recent 50 notifications, ordered by
 * date descending, with read/unread state and mark-as-read actions.
 *
 * Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */
export default function Notifications() {
  const { user } = useAuthStore()
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    subscribe,
    unsubscribe,
  } = useNotificationStore()

  useEffect(() => {
    if (!user?.id) return

    fetchNotifications(user.id)
    subscribe(user.id)

    return () => {
      unsubscribe()
    }
  }, [user?.id, fetchNotifications, subscribe, unsubscribe])

  const handleMarkAsRead = (notificationId: string) => {
    markAsRead(notificationId)
  }

  const handleMarkAllAsRead = () => {
    if (user?.id) {
      markAllAsRead(user.id)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <div className="text-center space-y-4">
          <div className="text-destructive text-4xl" aria-hidden="true">
            ⚠️
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Unable to Load Notifications
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          <button
            onClick={() => user?.id && fetchNotifications(user.id)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading notifications...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-primary">Notifications</h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 text-xs font-bold text-white bg-destructive rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <Link
            to="/app/passport"
            className="text-sm text-primary hover:underline"
          >
            ← Back
          </Link>
        </div>

        {/* Mark All as Read */}
        {unreadCount > 0 && (
          <div className="flex justify-end">
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm text-primary hover:underline font-medium"
              aria-label="Mark all notifications as read"
            >
              Mark all as read
            </button>
          </div>
        )}

        {/* Notification List */}
        {notifications.length === 0 ? (
          <div className="bg-card rounded-lg border p-8 text-center">
            <p className="text-muted-foreground">
              No notifications yet. You'll receive updates about announcements,
              submission status, badges, trails, and events here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2" aria-label="Notification list">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={handleMarkAsRead}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface NotificationItemProps {
  notification: Notification
  onMarkRead: (id: string) => void
}

function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const { id, title, body, type, is_read, created_at } = notification

  return (
    <li
      className={`bg-card rounded-lg border p-4 transition-colors ${
        is_read ? 'opacity-70' : 'border-primary/30 bg-primary/5'
      }`}
      aria-label={`${is_read ? 'Read' : 'Unread'} notification: ${title}`}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <span
          className="flex-shrink-0 text-lg mt-0.5"
          aria-hidden="true"
        >
          {getTypeIcon(type)}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h3
              className={`text-sm font-medium truncate ${
                is_read ? 'text-muted-foreground' : 'text-foreground'
              }`}
            >
              {title}
            </h3>
            {!is_read && (
              <span className="flex-shrink-0 w-2 h-2 bg-primary rounded-full" aria-hidden="true" />
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{body}</p>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              {formatRelativeDate(created_at)}
            </span>
            <span className="text-xs text-muted-foreground/70 capitalize">
              {formatType(type)}
            </span>
          </div>
        </div>

        {/* Mark as read button */}
        {!is_read && (
          <button
            onClick={() => onMarkRead(id)}
            className="flex-shrink-0 p-1.5 text-xs text-primary hover:bg-primary/10 rounded transition-colors"
            aria-label={`Mark "${title}" as read`}
            title="Mark as read"
          >
            ✓
          </button>
        )}
      </div>
    </li>
  )
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function getTypeIcon(type: NotificationType): string {
  switch (type) {
    case 'announcement':
      return '📢'
    case 'submission_status':
      return '📋'
    case 'badge_earned':
      return '🏅'
    case 'trail_launch':
      return '🗺️'
    case 'event':
      return '📅'
    default:
      return '🔔'
  }
}

function formatType(type: NotificationType): string {
  switch (type) {
    case 'announcement':
      return 'Announcement'
    case 'submission_status':
      return 'Submission'
    case 'badge_earned':
      return 'Badge'
    case 'trail_launch':
      return 'Trail'
    case 'event':
      return 'Event'
    default:
      return 'Notification'
  }
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}
