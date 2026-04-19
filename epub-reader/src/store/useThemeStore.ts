import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import * as FileSystem from 'expo-file-system/legacy';
import { AppTheme, generateTheme } from '../theme';

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

interface ThemeStore {
  paletteId: string;
  isDarkMode: boolean;
  theme: AppTheme;
  readerMode: 'scroll' | 'paged';
  fontSize: number;
  lineHeight: number;
  bgPresetId: string;
  setPalette: (id: string) => void;
  toggleDarkMode: () => void;
  setReaderMode: (mode: 'scroll' | 'paged') => void;
  setFontSize: (size: number) => void;
  setLineHeight: (lh: number) => void;
  setBgPresetId: (id: string) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      paletteId:  'mor-mavi',
      isDarkMode: false,
      theme:      generateTheme('mor-mavi', false),
      readerMode: 'scroll',
      fontSize:   16,
      lineHeight: 1.75,
      bgPresetId: 'Beyaz',
      setPalette:      (id)         => set((s) => ({ paletteId: id,  theme: generateTheme(id, s.isDarkMode) })),
      toggleDarkMode:  ()           => set((s) => ({ isDarkMode: !s.isDarkMode, theme: generateTheme(s.paletteId, !s.isDarkMode) })),
      setReaderMode:   (readerMode) => set({ readerMode }),
      setFontSize:     (fontSize)   => set({ fontSize }),
      setLineHeight:   (lineHeight) => set({ lineHeight }),
      setBgPresetId:   (bgPresetId) => set({ bgPresetId }),
    }),
    {
      name:    'epub-theme-v6',
      storage: createJSONStorage(() => fileStorage),
    }
  )
);
