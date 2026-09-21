import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle, interpolate } from 'react-native-reanimated';
import { Typography, Spacing } from '../../../theme';

interface ReaderDockProps {
  isEditMode: boolean;
  isNavMode: boolean;
  dockAnim: SharedValue<number>;
  navBarHeight: number;
  dockMode: any;
  setDockMode: (m: any) => void;
  scrollPct: number;
  theme: any;
  hasPrev: boolean;
  hasNext: boolean;
  goChapter: (dir: 1 | -1) => void;
  fontSize: number;
  setFontSize: (v: number) => void;
  lineHeight: number;
  setLineHeight: (v: number) => void;
  bgPreset: any;
  setBgPresetId: (id: string) => void;
  readerMode: 'scroll' | 'paged';
  setReaderMode: (m: 'scroll' | 'paged') => void;
  setIsEditMode: (v: boolean) => void;
  BG_PRESETS: any[];
  MIN_FONT: number;
  MAX_FONT: number;
}

export const ReaderDock: React.FC<ReaderDockProps> = React.memo(({
  isEditMode,
  isNavMode,
  dockAnim,
  navBarHeight,
  dockMode,
  setDockMode,
  scrollPct,
  theme,
  hasPrev,
  hasNext,
  goChapter,
  fontSize,
  setFontSize,
  lineHeight,
  setLineHeight,
  bgPreset,
  setBgPresetId,
  readerMode,
  setReaderMode,
  setIsEditMode,
  BG_PRESETS,
  MIN_FONT,
  MAX_FONT,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: dockAnim.value,
      transform: [
        { translateY: interpolate(dockAnim.value, [0, 1], [250, 0]) }
      ]
    };
  });

  if (isEditMode) return null;

  return (
    <Animated.View
      pointerEvents={isNavMode ? 'auto' : 'none'}
      style={[
        styles.dock,
        animatedStyle,
        {
          bottom: navBarHeight + 66,
          backgroundColor: theme.surface,
          borderColor: theme.border,
        }
      ]}
    >
      {/* ── NAV modu ── */}
      {dockMode === 'nav' && (
        <>
          {/* İlerleme çubuğu */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(scrollPct * 100)}%`, backgroundColor: theme.primary }]} />
            <View style={[styles.progressThumb, { left: `${Math.round(scrollPct * 100)}%`, backgroundColor: theme.primary }]} />
          </View>

          {/* Butonlar */}
          <View style={styles.dockRow}>
            <TouchableOpacity
              style={[styles.dockBtn, !hasPrev && { opacity: 0.3 }]}
              onPress={() => goChapter(-1)}
              disabled={!hasPrev}
            >
              <Text style={[styles.dockBtnText, { color: theme.textPrimary }]}>←</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.dockIconBtn, { backgroundColor: theme.primary }]} onPress={() => setDockMode('font')}>
              <Text style={[styles.dockIconBtnText, { color: theme.textOnDark }]}>Aa</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.dockIconBtn, { backgroundColor: theme.primary }]} onPress={() => setDockMode('bg')}>
              <View style={[styles.bgDot, { backgroundColor: theme.textOnDark }]} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.dockIconBtn, { backgroundColor: theme.primary }]} onPress={() => setDockMode('layout')}>
              <Text style={[styles.dockIconBtnText, { color: theme.textOnDark }]}>▤</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dockBtn, !hasNext && { opacity: 0.3 }]}
              onPress={() => goChapter(1)}
              disabled={!hasNext}
            >
              <Text style={[styles.dockBtnText, { color: theme.textPrimary }]}>→</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── FONT modu ── */}
      {dockMode === 'font' && (
        <View style={styles.fontPanel}>
          <TouchableOpacity style={styles.fontPanelClose} onPress={() => setDockMode('nav')}>
            <Text style={[styles.fontPanelCloseText, { color: theme.primary }]}>‹ Geri</Text>
          </TouchableOpacity>

          <View style={styles.fontRow}>
            <TouchableOpacity style={[styles.fontAdjBtn, { backgroundColor: theme.background }]} onPress={() => setFontSize(Math.max(MIN_FONT, fontSize - 1))}>
              <Text style={[styles.fontAdjText, { color: theme.textPrimary }]}>−</Text>
            </TouchableOpacity>
            <View style={styles.fontCenter}>
              <Text style={[styles.fontLabel, { color: theme.textSecondary }]}>Punto</Text>
              <Text style={[styles.fontValue, { color: theme.textPrimary }]}>{fontSize}px</Text>
            </View>
            <TouchableOpacity style={[styles.fontAdjBtn, { backgroundColor: theme.background }]} onPress={() => setFontSize(Math.min(MAX_FONT, fontSize + 1))}>
              <Text style={[styles.fontAdjText, { color: theme.textPrimary }]}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.fontRow, { marginTop: 16 }]}>
            <TouchableOpacity style={[styles.fontAdjBtn, { backgroundColor: theme.background }]} onPress={() => setLineHeight(Math.max(1.0, parseFloat((lineHeight - 0.1).toFixed(1))))}>
              <Text style={[styles.fontAdjText, { color: theme.textPrimary }]}>−</Text>
            </TouchableOpacity>
            <View style={styles.fontCenter}>
              <Text style={[styles.fontLabel, { color: theme.textSecondary }]}>Satır</Text>
              <Text style={[styles.fontValue, { color: theme.textPrimary }]}>{lineHeight.toFixed(1)}x</Text>
            </View>
            <TouchableOpacity style={[styles.fontAdjBtn, { backgroundColor: theme.background }]} onPress={() => setLineHeight(Math.min(3.0, parseFloat((lineHeight + 0.1).toFixed(1))))}>
              <Text style={[styles.fontAdjText, { color: theme.textPrimary }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── BG modu ── */}
      {dockMode === 'bg' && (
        <View style={styles.bgPanel}>
          <TouchableOpacity style={styles.fontPanelClose} onPress={() => setDockMode('nav')}>
            <Text style={[styles.fontPanelCloseText, { color: theme.primary }]}>‹ Geri</Text>
          </TouchableOpacity>
          <View style={styles.bgSwatches}>
            {BG_PRESETS.map((p, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.swatch, { backgroundColor: p.bg }, bgPreset.label === p.label && { borderColor: theme.primary, borderWidth: 2 }]}
                onPress={() => setBgPresetId(p.label)}
              />
            ))}
          </View>
        </View>
      )}

      {/* ── LAYOUT modu ── */}
      {dockMode === 'layout' && (
        <View style={styles.bgPanel}>
          <TouchableOpacity style={styles.fontPanelClose} onPress={() => setDockMode('nav')}>
            <Text style={[styles.fontPanelCloseText, { color: theme.primary }]}>‹ Geri</Text>
          </TouchableOpacity>
          <View style={styles.bgSwatches}>
            <TouchableOpacity
              style={[styles.swatchLayout, { backgroundColor: theme.background }, readerMode === 'scroll' && { borderColor: theme.primary, borderWidth: 2 }]}
              onPress={() => setReaderMode('scroll')}
            >
              <Text style={{ color: theme.textPrimary }}>Kaydırma</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.swatchLayout, { backgroundColor: theme.background }, readerMode === 'paged' && { borderColor: theme.primary, borderWidth: 2 }]}
              onPress={() => setReaderMode('paged')}
            >
              <Text style={{ color: theme.textPrimary }}>Sayfalama</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── EDIT PROMPT modu ── */}
      {dockMode === 'editPrompt' && (
        <View style={{ alignItems: 'center', paddingVertical: Spacing.sm }}>
          <Text style={{ fontSize: Typography.md, fontWeight: 'bold', color: theme.textPrimary, marginBottom: 8 }}>Düzenleme Modu</Text>
          <Text style={{ fontSize: Typography.sm, color: theme.textSecondary, marginBottom: 16, textAlign: 'center' }}>
            Metinde değişiklik yapmak için düzenleme moduna geçilsin mi?
          </Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity style={[styles.smBtn, { backgroundColor: theme.background }]} onPress={() => setDockMode('nav')}>
              <Text style={[styles.smBtnText, { color: theme.textPrimary }]}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smBtn, { backgroundColor: theme.primary }]} onPress={() => { setIsEditMode(true); setDockMode('nav'); }}>
              <Text style={[styles.smBtnText, { color: theme.textOnDark, fontWeight: 'bold' }]}>Düzenle</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 20, right: 20,
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 2,
    marginBottom: 20,
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -4, width: 12, height: 12,
    borderRadius: 6,
    marginLeft: -6,
  },
  dockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  dockBtn: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  dockBtnText: {
    fontSize: 24,
  },
  dockIconBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  dockIconBtnText: {
    fontSize: 16, fontWeight: 'bold',
  },
  bgDot: {
    width: 14, height: 14, borderRadius: 7,
  },
  fontPanel: {},
  fontPanelClose: {
    marginBottom: 16, alignSelf: 'flex-start',
  },
  fontPanelCloseText: {
    fontSize: 15, fontWeight: '600',
  },
  fontRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  fontAdjBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  fontAdjText: {
    fontSize: 24,
  },
  fontCenter: {
    alignItems: 'center',
  },
  fontLabel: {
    fontSize: 12, marginBottom: 2,
  },
  fontValue: {
    fontSize: 16, fontWeight: 'bold',
  },
  bgPanel: {
    alignItems: 'center', paddingVertical: 8,
  },
  bgSwatches: {
    flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center',
  },
  swatch: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)',
  },
  swatchLayout: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)',
  },
  smBtn: {
    width: 100, height: 42,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 8,
  },
  smBtnText: {
    fontSize: 14,
  },
});
