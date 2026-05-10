import { useShallow } from 'zustand/react/shallow';
import { useThemeStore } from '../../../store/useThemeStore';
import { useLibraryStore } from '../../../store/useLibraryStore';
import { useTimelineStore } from '../../../store/useTimelineStore';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const useReaderState = () => {
  // --- Ekran ve Güvenli Alan ---
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // --- Theme Store (Seçici ile) ---
  const themeState = useThemeStore(useShallow(state => ({
    theme: state.theme,
    readerMode: state.readerMode,
    fontSize: state.fontSize,
    lineHeight: state.lineHeight,
    bgPresetId: state.bgPresetId,
    isDarkMode: state.isDarkMode,
    enableReadingTracking: state.enableReadingTracking,
    showClockAndBattery: state.showClockAndBattery,
    enableVolumeNavigation: state.enableVolumeNavigation,
    scrollBuffer: state.scrollBuffer,
    setReaderMode: state.setReaderMode,
    setFontSize: state.setFontSize,
    setLineHeight: state.setLineHeight,
    setBgPresetId: state.setBgPresetId,
  })));

  // --- Library Store ---
  const libraryState = useLibraryStore(useShallow(state => ({
    books: state.books,
    getBook: state.getBook,
    updateCurrentChapter: state.updateCurrentChapter,
    updateScrollPosition: state.updateScrollPosition,
    updateChapterTitle: state.updateChapterTitle,
    addReadingTime: state.addReadingTime,
  })));

  // --- Timeline Store ---
  const timelineState = useTimelineStore(useShallow(state => ({
    activeBookId: state.activeBookId,
    activeChapterId: state.activeChapterId,
    currentText: state.currentText,
    versionsByNode: state.versionsByNode,
    addVersion: state.addVersion,
    reconstructVersion: state.reconstructVersion,
    viewVersion: state.viewVersion,
    viewedVersionId: state.viewedVersionId,
    setActiveChapter: state.setActiveChapter,
  })));

  return {
    insets,
    width,
    height,
    themeState,
    libraryState,
    timelineState,
  };
};
