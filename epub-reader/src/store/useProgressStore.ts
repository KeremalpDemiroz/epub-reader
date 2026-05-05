import { create } from 'zustand';

interface ProgressState {
  isMerging: boolean;
  mergeProgress: string;
  mergeProgressValue?: number;
  setMergeState: (isMerging: boolean, mergeProgress: string, mergeProgressValue?: number) => void;
}

export const useProgressStore = create<ProgressState>((set) => ({
  isMerging: false,
  mergeProgress: '',
  mergeProgressValue: 0,
  setMergeState: (isMerging, mergeProgress, mergeProgressValue) => set({ isMerging, mergeProgress, mergeProgressValue }),
}));
