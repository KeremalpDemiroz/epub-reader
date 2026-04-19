import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import * as FileSystem from 'expo-file-system/legacy';
import { EpubChapter, EPUB_STORAGE_DIR } from '../services/EpubManager';

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Book {
  id: string;
  filename: string;
  title: string;
  firstPagePath: string;
  baseDir: string;
  importedAt: number;
  lastReadAt?: number;
  chapters?: EpubChapter[];
  currentChapterId?: string;
  coverImagePath?: string | null;
  tagIds?: string[];
}

interface LibraryState {
  books: Book[];
  tags: Tag[];
  addBook: (book: Book) => void;
  removeBook: (id: string) => void;
  getBook: (id: string) => Book | undefined;
  updateLastRead: (id: string) => void;
  updateCurrentChapter: (bookId: string, chapterId: string) => void;
  addTag: (tag: Tag) => void;
  removeTag: (id: string) => void;
  toggleBookTag: (bookId: string, tagId: string) => void;
}

const fileStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await FileSystem.readAsStringAsync(`${FileSystem.documentDirectory}${name}.json`);
    } catch (e) {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await FileSystem.writeAsStringAsync(`${FileSystem.documentDirectory}${name}.json`, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await FileSystem.deleteAsync(`${FileSystem.documentDirectory}${name}.json`, { idempotent: true });
  },
};

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      books: [],
      tags: [],
      addBook: (book) => set({ books: [...get().books.filter(b => b.id !== book.id), book] }),
      removeBook: async (id) => {
        // 1. Fiziksel epub klasörünü sil
        try {
          await FileSystem.deleteAsync(EPUB_STORAGE_DIR + id, { idempotent: true });
        } catch (e) {
          console.warn('Fiziksel dosya silinemedi:', e);
        }
        // 2. Store'dan kaldır
        set({ books: get().books.filter(b => b.id !== id) });
      },
      getBook: (id) => get().books.find(b => b.id === id),
      updateLastRead: (id) => set({
        books: get().books.map(b => b.id === id ? { ...b, lastReadAt: Date.now() } : b)
      }),
      updateCurrentChapter: (bookId, chapterId) => set({
        books: get().books.map(b => b.id === bookId ? { ...b, currentChapterId: chapterId } : b)
      }),
      addTag: (tag) => set({
        tags: [...get().tags.filter(t => t.id !== tag.id), tag]
      }),
      removeTag: (id) => set({
        tags: get().tags.filter(t => t.id !== id),
        books: get().books.map(b => ({ ...b, tagIds: b.tagIds?.filter(tId => tId !== id) }))
      }),
      toggleBookTag: (bookId, tagId) => set({
        books: get().books.map(b => {
          if (b.id !== bookId) return b;
          const tags = b.tagIds || [];
          if (tags.includes(tagId)) {
            return { ...b, tagIds: tags.filter(t => t !== tagId) };
          } else {
            return { ...b, tagIds: [...tags, tagId] };
          }
        })
      })
    }),
    {
      name: 'library-storage',
      storage: createJSONStorage(() => fileStorage),
    }
  )
);
