/**
 * useNotifications — fetches, streams, and manages in-app notifications.
 *
 * - Fetches the last 50 notifications for the current user on mount.
 * - Subscribes to Supabase Realtime INSERT events on the notifications table
 *   so new notifications appear instantly without polling.
 * - Provides markAllRead() which calls the mark_notifications_read RPC.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

export interface AppNotification {
  id: string;
  user_id: string;
  group_id: string;
  type: string;
  title_key: string;
  body_key: string;
  metadata: {
    match_id?: string;
    home_team?: string;
    away_team?: string;
    home_score?: number;
    away_score?: number;
    points_earned?: number;
    coins_earned?: number;
    [key: string]: unknown;
  };
  is_read: boolean;
  created_at: string;
}

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
}

const MAX_NOTIFICATIONS = 50;

export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Unique per hook instance — prevents channel name collisions when both
  // Sidebar and TopBar mount simultaneously (same channel name → Supabase
  // deduplicates, and one cleanup removes the channel for the other).
  const instanceId = useRef(Math.random().toString(36).slice(2, 8));

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(MAX_NOTIFICATIONS);

      if (!error && data) {
        setNotifications(data as AppNotification[]);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime: prepend new notifications instantly
  useEffect(() => {
    if (!user) return;

    // Clean up any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`notifications:${user.id}:${instanceId.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as AppNotification;
          setNotifications(prev => {
            // Avoid duplicates (Realtime can occasionally double-fire)
            if (prev.some(n => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev].slice(0, MAX_NOTIFICATIONS);
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [user?.id]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.rpc('mark_notifications_read', { p_user_id: user.id });
  }, [user?.id]);

  const markRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return { notifications, unreadCount, loading, markAllRead, markRead };
}
