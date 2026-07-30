import { useNotificationStore } from '@/store/useNotificationStore';
import type { NotificationType } from '@/types/domain';

// Right now this just writes into the local mock notification store (AsyncStorage-backed via
// zustand persist). When a real backend exists for push/webhook delivery, swap the internals of
// notifyUser/notifyAdmin for actual server calls — keep these two function signatures stable so
// callers (useConsultStore, etc.) never need to change.

interface NotifyParams {
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string | null;
}

export function notifyUser(params: NotifyParams): void {
  useNotificationStore.getState().addNotification({
    audience: 'user',
    type: params.type,
    title: params.title,
    message: params.message,
    relatedId: params.relatedId ?? null,
  });
}

export function notifyAdmin(params: NotifyParams): void {
  useNotificationStore.getState().addNotification({
    audience: 'admin',
    type: params.type,
    title: params.title,
    message: params.message,
    relatedId: params.relatedId ?? null,
  });
}
