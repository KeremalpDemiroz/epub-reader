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
  currentScrollPct?: number;
  coverImagePath?: string | null;
  tagIds?: string[];
  totalReadTimeSeconds?: number;
}

interface LibraryState {
  books: Book[];
  tags: Tag[];
  addBook: (book: Book) => void;
  removeBook: (id: string) => void;
  getBook: (id: string) => Book | undefined;
  updateLastRead: (id: string) => void;
  updateCurrentChapter: (bookId: string, chapterId: string) => void;
  updateChapterTitle: (bookId: string, chapterId: string, title: string) => void;
  updateScrollPosition: (bookId: string, pct: number) => void;
  addTag: (tag: Tag) => void;
  removeTag: (id: string) => void;
  toggleBookTag: (bookId: string, tagId: string) => void;
  addReadingTime: (bookId: string, seconds: number) => void;
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
      addBook: (book) => { console.log(`[Store][Library] addBook: ${book.title} (${book.chapters?.length || 0} bölüm)`); set({ books: [...get().books.filter(b => b.id !== book.id), book] }); },
      removeBook: (id) => {
        console.log(`[Store][Library] removeBook: ${id}`);
        set({ books: get().books.filter(b => b.id !== id) });
      },
      getBook: (id) => get().books.find(b => b.id === id),
      updateLastRead: (id) => set({
        books: get().books.map(b => b.id === id ? { ...b, lastReadAt: Date.now() } : b)
      }),
      updateCurrentChapter: (bookId, chapterId) => { console.log(`[Store][Library] updateCurrentChapter: ${bookId} → ${chapterId}`); set({
        books: get().books.map(b => b.id === bookId ? { ...b, currentChapterId: chapterId, currentScrollPct: 0 } : b)
      }); },
      updateChapterTitle: (bookId, chapterId, title) => set({
        books: get().books.map(b => {
          if (b.id !== bookId || !b.chapters) return b;
          return {
            ...b,
            chapters: b.chapters.map(ch => ch.id === chapterId ? { ...ch, title } : ch)
          };
        })
      }),
      updateScrollPosition: (bookId, pct) => set({
        books: get().books.map(b => b.id === bookId ? { ...b, currentScrollPct: pct } : b)
      }),
      addTag: (tag) => { console.log(`[Store][Library] addTag: ${tag.name}`); set({
        tags: [...get().tags.filter(t => t.id !== tag.id), tag]
      }); },
      removeTag: (id) => { console.log(`[Store][Library] removeTag: ${id}`); set({
        tags: get().tags.filter(t => t.id !== id),
        books: get().books.map(b => ({ ...b, tagIds: b.tagIds?.filter(tId => tId !== id) }))
      }); },
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
      }),
      addReadingTime: (bookId, seconds) => set({
        books: get().books.map(b => 
          b.id === bookId ? { ...b, totalReadTimeSeconds: (b.totalReadTimeSeconds || 0) + seconds } : b
        )
      })
    }),
    {
      name: 'library-storage',
      storage: createJSONStorage(() => fileStorage),
    }
  )
);
