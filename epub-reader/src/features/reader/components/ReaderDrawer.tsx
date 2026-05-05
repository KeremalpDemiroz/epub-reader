import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Animated, Alert, StyleSheet } from 'react-native';

export type DrawerTab = 'chapters' | 'timeline';

interface ReaderDrawerProps {
  isDrawerOpen: boolean;
  slideAnim: Animated.Value;
  drawerPanResponder: any;
  DRAWER_WIDTH: number;
  theme: any;
  book: any;
  targetChapterId?: string;
  targetBookId?: string;
  isEditMode: boolean;
  versions: any[];
  closeDrawer: () => void;
  updateCurrentChapter: (bookId: string, chapterId: string) => void;
  loadVersion: (versionId: string) => void;
}

export const ReaderDrawer: React.FC<ReaderDrawerProps> = React.memo(({
  isDrawerOpen,
  slideAnim,
  drawerPanResponder,
  DRAWER_WIDTH,
  theme,
  book,
  targetChapterId,
  targetBookId,
  isEditMode,
  versions,
  closeDrawer,
  updateCurrentChapter,
  loadVersion,
}) => {
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('chapters');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (flatListRef.current && book?.chapters && targetChapterId) {
      const idx = book.chapters.findIndex((c: any) => c.id === targetChapterId);
      if (idx > -1) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index: idx, viewPosition: 0, animated: true });
        }, 150);
      }
    }
  }, [targetChapterId, book?.chapters]);

  return (
    <>
      {/* ── OVERLAY (drawer) ── */}
      {isDrawerOpen && (
        <Animated.View 
          style={[
            styles.overlay, 
            { opacity: slideAnim.interpolate({ inputRange: [0, DRAWER_WIDTH], outputRange: [1, 0] }) }
          ]}
        >
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={closeDrawer} />
        </Animated.View>
      )}

      {/* ── SAĞ ÇEKMECE ── */}
      <Animated.View 
        style={[styles.drawer, { 
          width: DRAWER_WIDTH, 
          transform: [{ translateX: slideAnim }],
          backgroundColor: theme.background 
        }]} 
        {...drawerPanResponder.panHandlers}
      >
        {/* Çekmece üstü */}
        <View style={[styles.drawerHeader, { borderBottomColor: theme.border }]}>
          <Text style={[styles.drawerBookTitle, { color: theme.primary }]} numberOfLines={1}>
            {book?.title || 'Bilinmeyen Kitap'}
          </Text>
        </View>

        {/* Sekmeler */}
        <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
          {(['chapters', 'timeline'] as DrawerTab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, drawerTab === tab && { borderBottomColor: theme.primary }]}
              onPress={() => setDrawerTab(tab)}
            >
              <Text style={[styles.tabText, { color: theme.textSecondary }, drawerTab === tab && { color: theme.primary, fontWeight: 'bold' }]}>
                {tab === 'chapters' ? 'Bölümler' : `Zaman Akışı${versions.length > 0 ? ` (${versions.length})` : ''}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bölümler */}
        <View style={{ flex: 1, display: drawerTab === 'chapters' ? 'flex' : 'none' }}>
          <FlatList
            ref={flatListRef}
            data={book?.chapters || []}
            keyExtractor={(item: any) => item.id}
            onScrollToIndexFailed={info => {
              const wait = new Promise(resolve => setTimeout(resolve, 300));
              wait.then(() => {
                flatListRef.current?.scrollToIndex({ index: info.index, viewPosition: 0, animated: false });
              });
            }}
            renderItem={({ item, index }) => {
              const isActive = targetChapterId === item.id;
              return (
                <TouchableOpacity
                  style={[styles.chapterRow, { borderBottomColor: theme.border }, isActive && { backgroundColor: theme.primaryLight }]}
                  onPress={() => {
                    if (isEditMode) {
                      Alert.alert('Düzenleme Modu', 'Bölüm geçişi yapmadan önce düzenlemeyi kaydedin veya iptal edin.');
                      return;
                    }
                    closeDrawer();
                    setTimeout(() => {
                      if (targetBookId) updateCurrentChapter(targetBookId, item.id);
                    }, 250);
                  }}
                >
                  <View style={[styles.badge, isActive && { backgroundColor: theme.primary }]}>
                    <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.chapterLabel, { color: theme.textPrimary }, isActive && { color: theme.primary, fontWeight: '600' }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={[styles.emptyTab, { color: theme.textMuted }]}>Bölüm bulunamadı.</Text>}
          />
        </View>

        {/* Zaman Akışı */}
        <View style={{ flex: 1, display: drawerTab === 'timeline' ? 'flex' : 'none' }}>
          <FlatList
            data={versions}
            keyExtractor={item => item.id}
            renderItem={({ item, index }) => {
              const date = new Date(item.timestamp);
              return (
                <View style={[styles.timelineRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.timelineInfo}>
                    <Text style={[styles.timelineDate, { color: theme.textPrimary }]}>
                      {date.toLocaleDateString()} {date.toLocaleTimeString()}
                    </Text>
                    <Text style={[styles.timelineDesc, { color: theme.textSecondary }]}>
                      {item.type === 'base' ? 'Orijinal Metin' : 'Düzenleme'} {index === versions.length - 1 && '(Aktif)'}
                    </Text>
                  </View>
                  {index !== versions.length - 1 && (
                    <TouchableOpacity
                      style={[styles.smBtn, { backgroundColor: theme.primaryLight }]}
                      onPress={() => {
                        Alert.alert('Sürümü Yükle', 'Bu sürüme dönmek istiyor musunuz? Sonraki tüm değişiklikler silinecek.', [
                          { text: 'İptal', style: 'cancel' },
                          { text: 'Dön', style: 'destructive', onPress: () => { loadVersion(item.id); closeDrawer(); } }
                        ]);
                      }}
                    >
                      <Text style={[styles.smBtnText, { color: theme.primary }]}>Dön</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={<Text style={[styles.emptyTab, { color: theme.textMuted }]}>Henüz değişiklik yapılmadı.</Text>}
          />
        </View>
      </Animated.View>
    </>
  );
});

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 40,
  },
  drawer: {
    position: 'absolute',
    top: 0, bottom: 0, right: 0,
    zIndex: 50,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  drawerHeader: {
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
  },
  drawerBookTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyTab: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  badge: {
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  badgeText: {
    fontSize: 12, fontWeight: 'bold', color: '#4B5563',
  },
  badgeTextActive: {
    color: '#fff',
  },
  chapterLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  timelineInfo: {
    flex: 1,
  },
  timelineDate: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  timelineDesc: {
    fontSize: 13,
  },
  smBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  smBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
