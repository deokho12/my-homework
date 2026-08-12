/**
 * Drop-in replacement for @react-native-async-storage/async-storage, backed by
 * localStorage. Zustand's `createJSONStorage` only needs getItem/setItem/removeItem,
 * and keeps calling them asynchronously — so the persisted store data and rehydration
 * timing behave the same as before.
 */
const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage full or blocked (private mode) — persistence is best-effort.
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },

  clear: async (): Promise<void> => {
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  },
};

export default AsyncStorage;
