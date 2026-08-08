import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type NotificationType =
  | 'announcement'
  | 'submission_status'
  | 'badge_earned'
  | 'trail_launch'
  | 'event'

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  type: NotificationType
  reference_id: string | null
  is_read: boolean
  created_at: string
}

interface OfflineNotification {
  id: string
  payload: Notification
  receivedAt: number
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  error: string | null
  channel: RealtimeChannel | null
  offlineQueue: OfflineNotification[]

  fetchNotifications: (userId: string) => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: (userId: string) => Promise<void>
  subscribe: (userId: string) => void
  unsubscribe: () => void
  deliverOfflineQueue: () => void
}

const MAX_NOTIFICATIONS = 50

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  channel: null,
  offlineQueue: [],

  fetchNotifications: async (userId: string) => {
    set({ isLoading: true, error: null })

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_NOTIFICATIONS)

    if (error) {
      set({ isLoading: false, error: error.message })
      return
    }

    const notifications = (data ?? []) as Notification[]
    const unreadCount = notifications.filter((n) => !n.is_read).length

    // Deliver any offline queued notifications
    const { offlineQueue } = get()
    if (offlineQueue.length > 0) {
      const queuedNotifications = offlineQueue.map((q) => q.payload)
      const merged = [...queuedNotifications, ...notifications]
        .filter(
          (n, i, arr) => arr.findIndex((x) => x.id === n.id) === i
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, MAX_NOTIFICATIONS)

      const mergedUnread = merged.filter((n) => !n.is_read).length
      set({
        notifications: merged,
        unreadCount: mergedUnread,
        isLoading: false,
        offlineQueue: [],
      })
    } else {
      set({ notifications, unreadCount, isLoading: false })
    }
  },

  markAsRead: async (notificationId: string) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(
        0,
        state.unreadCount -
          (state.notifications.find((n) => n.id === notificationId && !n.is_read)
            ? 1
            : 0)
      ),
    }))

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)

    if (error) {
      // Revert on failure - refetch
      const { notifications } = get()
      const userId = notifications[0]?.user_id
      if (userId) {
        get().fetchNotifications(userId)
      }
    }
  },

  markAllAsRead: async (userId: string) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    }))

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) {
      // Revert on failure - refetch
      get().fetchNotifications(userId)
    }
  },

  subscribe: (userId: string) => {
    const existingChannel = get().channel
    if (existingChannel) {
      supabase.removeChannel(existingChannel)
    }

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification

          if (!navigator.onLine) {
            // Queue for offline delivery (Req 16.6)
            set((state) => ({
              offlineQueue: [
                ...state.offlineQueue,
                {
                  id: newNotification.id,
                  payload: newNotification,
                  receivedAt: Date.now(),
                },
              ],
            }))
            return
          }

          set((state) => {
            const exists = state.notifications.some(
              (n) => n.id === newNotification.id
            )
            if (exists) return state

            const updated = [newNotification, ...state.notifications].slice(
              0,
              MAX_NOTIFICATIONS
            )
            return {
              notifications: updated,
              unreadCount: state.unreadCount + (newNotification.is_read ? 0 : 1),
            }
          })
        }
      )
      .subscribe()

    // Listen for online/offline events for offline queue delivery (Req 16.6)
    const handleOnline = () => {
      get().deliverOfflineQueue()
    }
    window.addEventListener('online', handleOnline)

    set({ channel })
  },

  unsubscribe: () => {
    const { channel } = get()
    if (channel) {
      supabase.removeChannel(channel)
      set({ channel: null })
    }
  },

  deliverOfflineQueue: () => {
    const { offlineQueue, notifications } = get()
    if (offlineQueue.length === 0) return

    const queuedNotifications = offlineQueue.map((q) => q.payload)
    const merged = [...queuedNotifications, ...notifications]
      .filter((n, i, arr) => arr.findIndex((x) => x.id === n.id) === i)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .slice(0, MAX_NOTIFICATIONS)

    const unreadCount = merged.filter((n) => !n.is_read).length
    set({ notifications: merged, unreadCount, offlineQueue: [] })
  },
}))
