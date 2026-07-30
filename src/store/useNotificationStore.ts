import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { notifications as seedNotifications } from '@/data/notifications';
import type { AppNotification, NotificationAudience } from '@/types/domain';

interface NotificationState {
  notifications: AppNotification[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: (audience: NotificationAudience) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: seedNotifications,
      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            {
              ...notification,
              id: `notif-${Date.now()}`,
              createdAt: new Date().toISOString(),
              isRead: false,
            },
            ...state.notifications,
          ],
        })),
      markAsRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((notification) =>
            notification.id === id ? { ...notification, isRead: true } : notification
          ),
        })),
      markAllAsRead: (audience) =>
        set((state) => ({
          notifications: state.notifications.map((notification) =>
            notification.audience === audience ? { ...notification, isRead: true } : notification
          ),
        })),
    }),
    {
      name: 'molarmolar-notifications',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
