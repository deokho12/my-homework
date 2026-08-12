import { create } from 'zustand';

interface ScrollShadowState {
  scrolled: boolean;
  setScrolled: (scrolled: boolean) => void;
}

export const useScrollShadowStore = create<ScrollShadowState>()((set, get) => ({
  scrolled: false,
  setScrolled: (scrolled) => {
    if (get().scrolled === scrolled) return;
    set({ scrolled });
  },
}));
