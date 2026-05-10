import { create } from 'zustand'; // force-recompile-1
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import * as FileSystem from 'expo-file-system/legacy';
import { createPatch, applyPatch } from '../services/TimelineService';

export interface Version {
  id: string;
  name: string;
  patch: string;
  timestamp: number;
}

interface TimelineState {
  activeBookId: string | null;
  activeChapterId: string | null;
  baseText: string;
  currentText: string;
  versionsByNode: Record<string, Version[]>;
  viewedVersionId: string | null;
  
  setActiveChapter: (bookId: string, chapterId: string, baseText: string) => void;
  addVersion: (newText: string) => void;
  reconstructVersion: (versionId: string) => string;
  viewVersion: (versionId: string) => string;
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

export const useTimelineStore = create<TimelineState>()(
  persist(
    (set, get) => ({
      activeBookId: null,
      activeChapterId: null,
      baseText: '',
      currentText: '',
      versionsByNode: {},
      
      viewedVersionId: null,
      
      setActiveChapter: (bookId: string, chapterId: string, text: string) => {
        const nodeKey = `${bookId}_${chapterId}`;
        const versions = get().versionsByNode[nodeKey] || [];
        
        let reconstructed = text;
        for (const v of versions) {
          reconstructed = applyPatch(reconstructed, v.patch);
        }
        
        set({
          activeBookId: bookId,
          activeChapterId: chapterId,
          baseText: text,
          currentText: reconstructed,
          viewedVersionId: null,
        });
      },
      
      addVersion: (newText: string) => {
        const { activeBookId, activeChapterId, currentText, baseText, versionsByNode } = get();
        if (!activeBookId || !activeChapterId || currentText === newText) return;
        
        const nodeKey = `${activeBookId}_${activeChapterId}`;
        const currentVersions = versionsByNode[nodeKey] || [];
        
        // Calculate the absolute latest text in the timeline
        let latestText = baseText;
        for (const v of currentVersions) {
          latestText = applyPatch(latestText, v.patch);
        }
        
        // Create patch from the absolute latest text to the new text
        // This ensures linear history is maintained even if the user edited while viewing an older version
        const patch = createPatch(latestText, newText);
        
        const newVersion: Version = {
          id: Date.now().toString(),
          name: `Versiyon ${currentVersions.length + 1}`,
          patch,
          timestamp: Date.now(),
        };
        
        set({
          currentText: newText,
          viewedVersionId: null,
          versionsByNode: {
            ...versionsByNode,
            [nodeKey]: [...currentVersions, newVersion]
          }
        });
      },
      
      reconstructVersion: (versionId: string) => {
        const { activeBookId, activeChapterId, baseText, versionsByNode } = get();
        if (!activeBookId || !activeChapterId) return '';
        
        if (versionId === 'original') {
          set({ currentText: baseText });
          return baseText;
        }
        
        let reconstructed = baseText;
        const nodeKey = `${activeBookId}_${activeChapterId}`;
        const versions = versionsByNode[nodeKey] || [];
        
        for (const v of versions) {
          reconstructed = applyPatch(reconstructed, v.patch);
          if (v.id === versionId) {
            break;
          }
        }
        
        set({ currentText: reconstructed });
        return reconstructed;
      },
      
      viewVersion: (versionId: string) => {
        const { activeBookId, activeChapterId, baseText, versionsByNode } = get();
        if (!activeBookId || !activeChapterId) return '';
        
        const nodeKey = `${activeBookId}_${activeChapterId}`;
        const versions = versionsByNode[nodeKey] || [];
        
        if (versionId === 'original') {
          set({ currentText: baseText, viewedVersionId: 'original' });
          return baseText;
        }
        
        let reconstructed = baseText;
        
        for (const v of versions) {
          reconstructed = applyPatch(reconstructed, v.patch);
          if (v.id === versionId) {
            break;
          }
        }
        
        set({ 
          currentText: reconstructed,
          viewedVersionId: versionId
        });
        return reconstructed;
      }
    }),
    {
      name: 'timeline-storage',
      storage: createJSONStorage(() => fileStorage),
      partialize: (state) => ({ 
        versionsByNode: state.versionsByNode,
        activeBookId: state.activeBookId,
        activeChapterId: state.activeChapterId
      }),
    }
  )
);
