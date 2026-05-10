import { useRef, useMemo } from 'react';
import { PanResponder, Animated } from 'react-native';

interface UseReaderGesturesProps {
  width: number;
  DRAWER_WIDTH: number;
  isDrawerOpenRef: React.MutableRefObject<boolean>;
  setIsDrawerOpen: (val: boolean) => void;
  slideAnim: Animated.Value;
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
  const openGestureOffset = useRef(DRAWER_WIDTH);
  const closeGestureOffset = useRef(0);

  const setDrawerOpen = (v: boolean) => {
    isDrawerOpenRef.current = v;
    setIsDrawerOpen(v);
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (evt, g) => {
      if (isEditMode) return false;
      if (isDrawerOpenRef.current) return false;
      return evt.nativeEvent.pageX > width * 0.85
        && g.dx < -6
        && Math.abs(g.dx) > Math.abs(g.dy) * 1.2;
    },
    onPanResponderGrant: () => {
      slideAnim.stopAnimation((v) => { openGestureOffset.current = v; });
      isDrawerOpenRef.current = true;
      setIsDrawerOpen(true);
    },
    onPanResponderMove: (_e, g) => {
      const next = Math.max(0, Math.min(DRAWER_WIDTH, openGestureOffset.current + g.dx));
      slideAnim.setValue(next);
    },
    onPanResponderRelease: (_e, g) => {
      const cur = openGestureOffset.current + g.dx;
      if (cur < DRAWER_WIDTH * 0.65 || g.vx < -0.4) {
        Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      } else {
        Animated.timing(slideAnim, { toValue: DRAWER_WIDTH, duration: 180, useNativeDriver: true })
          .start(() => setDrawerOpen(false));
      }
    },
  }), [width, DRAWER_WIDTH, slideAnim, setIsDrawerOpen, isEditMode]);

  const drawerPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_e, g) => {
      if (!isDrawerOpenRef.current) return false;
      return g.dx > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2;
    },
    onPanResponderGrant: () => {
      slideAnim.stopAnimation((v) => { closeGestureOffset.current = v; });
    },
    onPanResponderMove: (_e, g) => {
      const next = Math.max(0, Math.min(DRAWER_WIDTH, closeGestureOffset.current + g.dx));
      slideAnim.setValue(next);
    },
    onPanResponderRelease: (_e, g) => {
      const cur = closeGestureOffset.current + g.dx;
      if (cur > DRAWER_WIDTH * 0.35 || g.vx > 0.4) {
        Animated.timing(slideAnim, { toValue: DRAWER_WIDTH, duration: 180, useNativeDriver: true })
          .start(() => setDrawerOpen(false));
      } else {
        Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      }
    },
  }), [DRAWER_WIDTH, slideAnim, setIsDrawerOpen]);

  return {
    panResponder,
    drawerPanResponder,
    setDrawerOpen,
  };
};
