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
  enableHaptics: boolean;
  showClockAndBattery: boolean;
  enableReadingTracking: boolean;
  enableVolumeNavigation: boolean;
  scrollBuffer: number;
  setPalette: (id: string) => void;
  toggleDarkMode: () => void;
  setReaderMode: (mode: 'scroll' | 'paged') => void;
  setFontSize: (size: number) => void;
  setLineHeight: (lh: number) => void;
  setBgPresetId: (id: string) => void;
  setEnableHaptics: (val: boolean) => void;
  setShowClockAndBattery: (val: boolean) => void;
  setEnableReadingTracking: (val: boolean) => void;
  setEnableVolumeNavigation: (val: boolean) => void;
  setScrollBuffer: (val: number) => void;
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
      enableHaptics: true,
      showClockAndBattery: true,
      enableReadingTracking: true,
      enableVolumeNavigation: true,
      scrollBuffer: 50,
      setPalette:      (id)         => { console.log(`[Store][Theme] setPalette: ${id}`); set((s) => ({ paletteId: id,  theme: generateTheme(id, s.isDarkMode) })); },
      toggleDarkMode:  ()           => set((s) => { console.log(`[Store][Theme] toggleDarkMode: ${!s.isDarkMode}`); return { isDarkMode: !s.isDarkMode, theme: generateTheme(s.paletteId, !s.isDarkMode) }; }),
      setReaderMode:   (readerMode) => { console.log(`[Store][Theme] setReaderMode: ${readerMode}`); set({ readerMode }); },
      setFontSize:     (fontSize)   => { console.log(`[Store][Theme] setFontSize: ${fontSize}`); set({ fontSize }); },
      setLineHeight:   (lineHeight) => { console.log(`[Store][Theme] setLineHeight: ${lineHeight}`); set({ lineHeight }); },
      setBgPresetId:   (bgPresetId) => { console.log(`[Store][Theme] setBgPresetId: ${bgPresetId}`); set({ bgPresetId }); },
      setEnableHaptics: (enableHaptics) => { console.log(`[Store][Theme] setEnableHaptics: ${enableHaptics}`); set({ enableHaptics }); },
      setShowClockAndBattery: (showClockAndBattery) => { console.log(`[Store][Theme] setShowClockAndBattery: ${showClockAndBattery}`); set({ showClockAndBattery }); },
      setEnableReadingTracking: (enableReadingTracking) => { console.log(`[Store][Theme] setEnableReadingTracking: ${enableReadingTracking}`); set({ enableReadingTracking }); },
      setEnableVolumeNavigation: (enableVolumeNavigation) => { console.log(`[Store][Theme] setEnableVolumeNavigation: ${enableVolumeNavigation}`); set({ enableVolumeNavigation }); },
      setScrollBuffer: (scrollBuffer) => { console.log(`[Store][Theme] setScrollBuffer: ${scrollBuffer}`); set({ scrollBuffer }); },
    }),
    {
      name:    'epub-theme-v6',
      storage: createJSONStorage(() => fileStorage),
    }
  )
);
