import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Battery from 'expo-battery';

interface ReaderStatusOverlayProps {
  show: boolean;
  theme: any;
  insets: { top: number; bottom: number; left: number; right: number };
  bgPreset?: { bg: string; fg: string; label: string };
  bottomOffset?: number;
  opacity?: number;
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
}

export const ReaderStatusOverlay: React.FC<ReaderStatusOverlayProps> = React.memo(({ show, theme, insets, bgPreset, bottomOffset, opacity = 1, pointerEvents = 'none' }) => {
  const [time, setTime] = useState(new Date());
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  useEffect(() => {
    if (!show) return;

    const updateStats = async () => {
      setTime(new Date());
      try {
        const level = await Battery.getBatteryLevelAsync();
        if (level >= 0) setBatteryLevel(Math.round(level * 100));
      } catch (e) {}
    };

    updateStats();
    const interval = setInterval(updateStats, 30000);

    const batterySub = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      setBatteryLevel(Math.round(batteryLevel * 100));
    });

    return () => {
      clearInterval(interval);
      batterySub.remove();
    };
  }, [show]);

  if (!show) return null;

  return (
    <View style={[
      styles.container, 
      { 
        bottom: bottomOffset !== undefined ? bottomOffset : insets.bottom,
        paddingBottom: 6, 
        paddingTop: 6,
        backgroundColor: bgPreset?.bg || 'transparent',
        opacity
      }
    ]} pointerEvents={pointerEvents}>
      <Text style={[styles.text, { color: theme.textMuted }]}>
        {time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
      </Text>
      {batteryLevel !== null && (
        <Text style={[styles.text, { color: theme.textMuted }]}>
          %{batteryLevel}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  text: {
    fontSize: 10,
    fontWeight: '600',
  },
});
