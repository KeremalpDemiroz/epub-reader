import React from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';

interface ReaderHeaderProps {
  isEditMode: boolean;
  isNavMode: boolean;
  headerAnim: Animated.Value;
  insets: { top: number };
  bookTitle?: string;
  theme: any;
  hideNav: () => void;
  setIsEditMode: (val: boolean) => void;
  openDrawer: () => void;
  navigation: any;
}

export const ReaderHeader: React.FC<ReaderHeaderProps> = React.memo(({
  isEditMode,
  isNavMode,
  headerAnim,
  insets,
  bookTitle,
  theme,
  hideNav,
  setIsEditMode,
  openDrawer,
  navigation,
}) => {
  if (isEditMode) return null;

  const headerTranslate = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-150, 0] });

  return (
    <Animated.View
      pointerEvents={isNavMode ? 'auto' : 'none'}
      style={[styles.topBar, {
        transform: [{ translateY: headerTranslate }],
        opacity: headerAnim,
        paddingTop: insets.top,
        backgroundColor: theme.surface,
        borderBottomColor: theme.border,
      }]}
    >
      <View style={styles.topInner}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={[styles.backText, { color: theme.textPrimary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: theme.textPrimary }]} numberOfLines={1}>
          {bookTitle || 'Kitap Oku'}
        </Text>
        <View style={styles.topRight}>
          <TouchableOpacity style={[styles.smBtn, { backgroundColor: theme.background }]} onPress={() => { hideNav(); setIsEditMode(true); }}>
            <Text style={[styles.smBtnText, { color: theme.textPrimary }]}>✏</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.smBtn, { backgroundColor: theme.primary }]} onPress={openDrawer}>
            <Text style={[styles.smBtnText, { color: theme.textOnDark }]}>☰</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
    borderBottomWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  topInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 12,
  },
  backBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  backText: {
    fontSize: 28, lineHeight: 32,
  },
  topTitle: {
    flex: 1, fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginHorizontal: 12,
  },
  topRight: {
    flexDirection: 'row', gap: 8, marginRight: 8,
  },
  smBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  smBtnText: {
    fontSize: 16,
  },
});
