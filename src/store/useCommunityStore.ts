import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { qaPosts } from '@/data/qaPosts';
import type { ProcedureId, QAPost } from '@/types/domain';

interface CommunityState {
  posts: QAPost[];
  addPost: (post: { title: string; content: string; procedureId: ProcedureId; authorName: string }) => string;
  incrementView: (postId: string) => void;
}

export const useCommunityStore = create<CommunityState>()(
  persist(
    (set) => ({
      posts: qaPosts,
      addPost: (post) => {
        const id = `q-${Date.now()}`;
        set((state) => ({
          posts: [
            {
              ...post,
              id,
              createdAt: new Date().toISOString().slice(0, 10),
              viewCount: 0,
              answers: [],
            },
            ...state.posts,
          ],
        }));
        return id;
      },
      incrementView: (postId) =>
        set((state) => ({
          posts: state.posts.map((post) =>
            post.id === postId ? { ...post, viewCount: post.viewCount + 1 } : post
          ),
        })),
    }),
    {
      name: 'molarmolar-community-posts',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
