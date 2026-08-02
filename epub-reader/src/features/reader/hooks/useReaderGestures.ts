import { useRef, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { SharedValue, withTiming, runOnJS } from 'react-native-reanimated';

interface UseReaderGesturesProps {
  width: number;
  DRAWER_WIDTH: number;
  isDrawerOpenRef: React.MutableRefObject<boolean>;
  setIsDrawerOpen: (val: boolean) => void;
  slideAnim: SharedValue<number>;
  isEditMode: boolean;
}

export const useReaderGestures = ({
  width,
  DRAWER_WIDTH,
  isDrawerOpenRef,
  setIsDrawerOpen,
  slideAnim,
  isEditMode,
}: UseReaderGesturesProps) => {

  const setDrawerOpen = (v: boolean) => {
    isDrawerOpenRef.current = v;
    setIsDrawerOpen(v);
  };

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      // no-op
    })
    .onUpdate((e) => {
      if (isEditMode) return;
      if (isDrawerOpenRef.current) return;
      // Sadece ekranın sağ %15'inden başlayan sola kaydırmalar
      if (e.startX > width * 0.85 && e.translationX < -6 && Math.abs(e.translationX) > Math.abs(e.translationY) * 1.2) {
        slideAnim.value = Math.max(0, Math.min(DRAWER_WIDTH, DRAWER_WIDTH + e.translationX));
      }
    })
    .onEnd((e) => {
      if (isEditMode || isDrawerOpenRef.current) return;
      if (e.startX > width * 0.85 && e.translationX < -6 && Math.abs(e.translationX) > Math.abs(e.translationY) * 1.2) {
        const cur = DRAWER_WIDTH + e.translationX;
        if (cur < DRAWER_WIDTH * 0.65 || e.velocityX < -400) {
          runOnJS(setDrawerOpen)(true);
          slideAnim.value = withTiming(0, { duration: 250 });
        } else {
          slideAnim.value = withTiming(DRAWER_WIDTH, { duration: 250 });
        }
      }
    });

  const drawerPanGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (!isDrawerOpenRef.current) return;
      // Sadece sağa kaydırmalar
      if (e.translationX > 6 && Math.abs(e.translationX) > Math.abs(e.translationY) * 1.2) {
        slideAnim.value = Math.max(0, Math.min(DRAWER_WIDTH, e.translationX));
      }
    })
    .onEnd((e) => {
      if (!isDrawerOpenRef.current) return;
      if (e.translationX > 6 && Math.abs(e.translationX) > Math.abs(e.translationY) * 1.2) {
        if (e.translationX > DRAWER_WIDTH * 0.35 || e.velocityX > 400) {
          slideAnim.value = withTiming(DRAWER_WIDTH, { duration: 250 }, () => {
            runOnJS(setDrawerOpen)(false);
          });
        } else {
          slideAnim.value = withTiming(0, { duration: 250 });
        }
      }
    });

  return {
    panGesture,
    drawerPanGesture,
    setDrawerOpen,
  };
};
