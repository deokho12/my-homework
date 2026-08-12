import { router } from '@/navigation';

import { useAuthStore } from '@/store/useAuthStore';

export function useRequireAuth() {
  const user = useAuthStore((state) => state.user);

  return function requireAuth(onAuthed: () => void, redirectPath?: string) {
    if (user) {
      onAuthed();
      return;
    }

    router.push({ pathname: '/auth/login', params: redirectPath ? { redirect: redirectPath } : {} });
  };
}
