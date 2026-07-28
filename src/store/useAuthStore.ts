import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AuthProvider, User } from '@/types/domain';

interface StoredAccount {
  id: string;
  email: string;
  name: string;
  password: string;
  provider: AuthProvider;
}

type AuthResult = { ok: true } | { ok: false; message: string };

interface AuthState {
  user: User | null;
  accounts: StoredAccount[];
  signUp: (params: { email: string; password: string; name: string }) => AuthResult;
  logIn: (params: { email: string; password: string }) => AuthResult;
  logOut: () => void;
}

function toUser(account: StoredAccount): User {
  return { id: account.id, email: account.email, name: account.name, provider: account.provider };
}

// Mock-only auth: accounts (including plaintext passwords) live in local AsyncStorage.
// Swap this store's internals for a real backend (Supabase/Firebase) before shipping.
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accounts: [],

      signUp: ({ email, password, name }) => {
        const normalizedEmail = email.trim().toLowerCase();

        if (get().accounts.some((account) => account.email === normalizedEmail)) {
          return { ok: false, message: '이미 가입된 이메일이에요' };
        }

        const account: StoredAccount = {
          id: `user-${Date.now()}`,
          email: normalizedEmail,
          name: name.trim(),
          password,
          provider: 'email',
        };

        set((state) => ({ accounts: [...state.accounts, account], user: toUser(account) }));
        return { ok: true };
      },

      logIn: ({ email, password }) => {
        const normalizedEmail = email.trim().toLowerCase();
        const account = get().accounts.find((item) => item.email === normalizedEmail);

        if (!account || account.password !== password) {
          return { ok: false, message: '이메일 또는 비밀번호가 올바르지 않아요' };
        }

        set({ user: toUser(account) });
        return { ok: true };
      },

      logOut: () => set({ user: null }),
    }),
    {
      name: 'molarmolar-auth',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
