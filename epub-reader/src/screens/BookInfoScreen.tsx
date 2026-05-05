import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, TextInput, FlatList, Animated, PanResponder,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryStore } from '../store/useLibraryStore';
import { useThemeStore } from '../store/useThemeStore';
import { AppTheme, Spacing, Typography, Radius, Shadow } from '../theme';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HANDLE_H = 100;
const SHEET_EXPANDED = SCREEN_H * 0.5;
const CHAPTER_ITEM_HEIGHT = 54;

type RootStackParamList = {
  DrawerRoot: undefined;
  Reader: { bookId: string };
  BookInfo: { bookId: string };
};
type Props = NativeStackScreenProps<RootStackParamList, 'BookInfo'>;

export default function BookInfoScreen({ route, navigation }: Props) {
  const { bookId }     = route.params;
  const book           = useLibraryStore(s => s.getBook(bookId));
  const tags           = useLibraryStore(s => s.tags);
  const addTag         = useLibraryStore(s => s.addTag);
  const removeTag      = useLibraryStore(s => s.removeTag);
  const toggleBookTag  = useLibraryStore(s => s.toggleBookTag);
  const { theme }      = useThemeStore();
  const insets         = useSafeAreaInsets();
  const styles         = getStyles(theme);

  const [showChapters,    setShowChapters]    = useState(false);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName,      setNewTagName]      = useState('');
  const [sheetExpanded,   setSheetExpanded]   = useState(false);
  const [tagDeleteMode,   setTagDeleteMode]   = useState(false);

  const listRef = useRef<FlatList>(null);
  const SHEET_COLLAPSED = SHEET_HANDLE_H + (insets.bottom > 0 ? insets.bottom : 16);

  // ── Animasyon (0 = collapsed, 1 = expanded) ─────────────────
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const sheetHeight = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_COLLAPSED, SHEET_EXPANDED],
  });

  const expandSheet = () => {
    setSheetExpanded(true);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: false, bounciness: 4 }).start();
  };
  const collapseSheet = () => {
    setSheetExpanded(false);
    setTagDeleteMode(false);
    setShowNewTagInput(false);
    setNewTagName('');
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: false, bounciness: 4 }).start();
  };

  const sheetPan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => {
      const base  = sheetExpanded ? 1 : 0;
      const delta = -g.dy / (SHEET_EXPANDED - SHEET_COLLAPSED);
      sheetAnim.setValue(Math.max(0, Math.min(1, base + delta)));
    },
    onPanResponderRelease: (_, g) => {
      const cur = (sheetAnim as any)._value as number;
      if (g.dy < -40 || cur > 0.5) expandSheet(); else collapseSheet();
    },
  })).current;

  const swipeBackPan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dx > 20 && Math.abs(g.dy) < 40,
    onPanResponderRelease: (_, g) => { if (g.dx > 80 && g.vx > 0.3) navigation.goBack(); },
  })).current;

  if (!book) return null;

  const bookTags      = tags.filter(t => book.tagIds?.includes(t.id));
  const otherTags     = tags.filter(t => !book.tagIds?.includes(t.id));
  const totalChapters = book.chapters?.length || 0;
  const currentIndex  = book.chapters?.findIndex(c => c.id === book.currentChapterId) ?? 0;
  const pct = totalChapters > 0 ? Math.round(((currentIndex + 1) / totalChapters) * 100) : 0;

  useEffect(() => {
    if (showChapters && currentIndex >= 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index: currentIndex,
          animated: true,
          viewPosition: 0.5,
        });
      }, 100);
    }
  }, [showChapters]);

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    const color  = colors[Math.floor(Math.random() * colors.length)];
    const newTag = { id: Date.now().toString(), name: newTagName.trim(), color };
    addTag(newTag);
    toggleBookTag(bookId, newTag.id);
    setNewTagName('');
    setShowNewTagInput(false);
  };

  const handleChapterSelect = (chapterId: string) => {
    useLibraryStore.getState().updateCurrentChapter(bookId, chapterId);
    navigation.navigate('Reader', { bookId });
  };

  const contentHeader = (
    <View style={styles.fixedHeader}>
      <View style={[styles.topSection, { paddingTop: insets.top + Spacing.lg }]}>
        <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.coverWrapper}>
          {book.coverImagePath
            ? <Image source={{ uri: book.coverImagePath }} style={styles.coverImage} />
            : <View style={[styles.coverImage, { backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.coverFallback}>{book.title[0]?.toUpperCase()}</Text>
              </View>}
          <View style={styles.pctBadge}>
            <Text style={styles.pctBadgeText}>%{pct}</Text>
          </View>
        </View>
      </View>
      <View style={styles.metaBox}>
        <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
        <Text style={styles.dateText}>Eklenme: {new Date(book.importedAt).toLocaleDateString('tr-TR')}</Text>
        <Text style={styles.dateText}>
          Son Okuma: {book.lastReadAt ? new Date(book.lastReadAt).toLocaleDateString('tr-TR') : 'Hiç okunmadı'}
        </Text>
        {book.totalReadTimeSeconds ? (
          <Text style={[styles.dateText, { marginTop: 2, color: theme.primary }]}>
            Toplam Okuma: {book.totalReadTimeSeconds >= 3600 
              ? `${Math.floor(book.totalReadTimeSeconds / 3600)} Saat ${Math.floor((book.totalReadTimeSeconds % 3600) / 60)} Dk`
              : `${Math.floor(book.totalReadTimeSeconds / 60)} Dakika`}
          </Text>
        ) : null}
        <TouchableOpacity style={styles.chapterBtn} onPress={() => setShowChapters(v => !v)}>
          <Text style={styles.chapterBtnText}>
            Bölüm Listesi ({totalChapters > 0 ? (currentIndex >= 0 ? currentIndex + 1 : 1) : 0}/{totalChapters}) {showChapters ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const TagChip = ({ t, deletable }: { t: { id: string; name: string; color: string }; deletable?: boolean }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onLongPress={() => { if (!sheetExpanded) expandSheet(); setTagDeleteMode(true); }}
      style={[styles.tag, { backgroundColor: t.color }]}
    >
      <Text style={styles.tagText}>{t.name}</Text>
      {deletable && (
        <TouchableOpacity
          style={styles.tagDeleteBtn}
          onPress={() => { toggleBookTag(bookId, t.id); }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.tagDeleteX}>×</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen} {...swipeBackPan.panHandlers}>
      {contentHeader}

      <View style={{ flex: 1 }}>
        {showChapters ? (
          <FlatList
            ref={listRef}
            data={book.chapters}
            keyExtractor={ch => ch.id}
            getItemLayout={(_, index) => ({
              length: CHAPTER_ITEM_HEIGHT,
              offset: CHAPTER_ITEM_HEIGHT * index,
              index,
            })}
            contentContainerStyle={{ paddingBottom: SHEET_EXPANDED + 24 }}
            renderItem={({ item: ch, index: idx }) => {
              const isCurrent = ch.id === book.currentChapterId;
              return (
                <TouchableOpacity
                  style={[styles.chapterItem, isCurrent && { backgroundColor: theme.primaryLight }]}
                  onPress={() => handleChapterSelect(ch.id)}
                >
                  <Text style={[styles.chapterItemText, isCurrent && { color: theme.primary, fontWeight: 'bold' }]}>
                    {idx + 1}. {ch.title}
                  </Text>
                  {isCurrent && (
                    <Text style={{ fontSize: 18, color: theme.primary }}>🔖</Text>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: theme.background }} />
        )}
      </View>

      <Animated.View style={[styles.sheet, { height: sheetHeight }]}>
        <View {...sheetPan.panHandlers} style={styles.sheetHandle}>
          <View style={styles.handleBar} />
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitle}>Etiketler</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {tagDeleteMode && (
                <TouchableOpacity onPress={() => setTagDeleteMode(false)}>
                  <Text style={[styles.sheetAction, { color: theme.textMuted }]}>Bitti</Text>
                </TouchableOpacity>
              )}
              {sheetExpanded
                ? <TouchableOpacity onPress={collapseSheet}>
                    <Text style={[styles.sheetAction, { color: theme.textMuted }]}>Kapat ↓</Text>
                  </TouchableOpacity>
                : <TouchableOpacity onPress={expandSheet}>
                    <Text style={[styles.sheetAction, { color: theme.primary }]}>Yönet ↑</Text>
                  </TouchableOpacity>}
            </View>
          </View>
        </View>

        {!sheetExpanded && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: Spacing.base, alignItems: 'center', paddingBottom: insets.bottom }}
          >
            {bookTags.length === 0
              ? <Text style={styles.noTagsText}>Henüz etiket yok — yukarı çek</Text>
              : bookTags.map(t => <TagChip key={t.id} t={t} deletable={tagDeleteMode} />)
            }
          </ScrollView>
        )}

        {sheetExpanded && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.base, gap: 16, paddingBottom: insets.bottom + 16 }}>
            {bookTags.length > 0 && (
              <View>
                <Text style={styles.sectionLabel}>Bu kitaba atanmış</Text>
                <View style={styles.chipWrap}>
                  {bookTags.map(t => <TagChip key={t.id} t={t} deletable />)}
                </View>
              </View>
            )}

            {otherTags.length > 0 && (
              <View>
                <Text style={styles.sectionLabel}>Ekle</Text>
                <View style={styles.chipWrap}>
                  {otherTags.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.tag, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: t.color }]}
                      onPress={() => toggleBookTag(bookId, t.id)}
                    >
                      <Text style={[styles.tagText, { color: t.color }]}>{t.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {showNewTagInput ? (
              <View style={{ gap: 8 }}>
                <TextInput
                  style={styles.input}
                  placeholder="Etiket adı..."
                  placeholderTextColor={theme.textMuted}
                  value={newTagName}
                  onChangeText={setNewTagName}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.sheetBtn, { flex: 1, borderWidth: 1, borderColor: theme.border }]}
                    onPress={() => { setShowNewTagInput(false); setNewTagName(''); }}
                  >
                    <Text style={{ color: theme.textSecondary, textAlign: 'center', fontWeight: Typography.medium }}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.sheetBtn, { flex: 1, backgroundColor: theme.primary }]}
                    onPress={handleCreateTag}
                  >
                    <Text style={{ color: '#fff', textAlign: 'center', fontWeight: Typography.semiBold }}>Oluştur</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.sheetBtn, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.border }]}
                onPress={() => setShowNewTagInput(true)}
              >
                <Text style={{ color: theme.textSecondary, textAlign: 'center', fontWeight: Typography.medium }}>
                  + Yeni Etiket Oluştur
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  fixedHeader: { backgroundColor: theme.background, zIndex: 10 },
  topSection: { alignItems: 'center', paddingBottom: Spacing.md },
  backBtn: {
    position: 'absolute', left: 20, width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: theme.surface, borderRadius: Radius.full, ...Shadow.sm, zIndex: 10,
  },
  backBtnText: { fontSize: 32, color: theme.textPrimary, lineHeight: 36, marginTop: -2 },
  coverWrapper: { position: 'relative', ...Shadow.lg },
  coverImage: { width: 140, height: 200, borderRadius: Radius.lg },
  coverFallback: { fontSize: 60, color: 'rgba(255,255,255,0.7)', fontWeight: Typography.bold },
  pctBadge: {
    position: 'absolute', top: -10, right: -10,
    backgroundColor: '#F87171', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Radius.sm, ...Shadow.sm,
  },
  pctBadgeText: { color: '#fff', fontWeight: Typography.bold, fontSize: 12 },

  metaBox: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, ...Shadow.md,
  },
  title:    { fontSize: Typography.md, fontWeight: Typography.bold, color: theme.textPrimary, marginBottom: 4 },
  dateText: { fontSize: 10, color: theme.textMuted, marginBottom: 1 },

  chapterBtn: {
    borderWidth: 1, borderColor: theme.border, borderRadius: Radius.md,
    paddingVertical: 12, alignItems: 'center', marginTop: 12,
  },
  chapterBtnText: { color: theme.textPrimary, fontWeight: Typography.medium, fontSize: Typography.sm },
  chapterItem: {
    paddingHorizontal: Spacing.xl, height: CHAPTER_ITEM_HEIGHT,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  chapterItemText: { color: theme.textPrimary, fontSize: 13, flex: 1 },

  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: theme.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    ...Shadow.lg,
  },
  sheetHandle: { paddingHorizontal: Spacing.base, paddingTop: 10, paddingBottom: 8 },
  handleBar: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: theme.border, alignSelf: 'center', marginBottom: 10,
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle:    { fontSize: Typography.sm, fontWeight: Typography.semiBold, color: theme.textSecondary },
  sheetAction:   { fontSize: Typography.sm, fontWeight: Typography.semiBold },

  sectionLabel: { fontSize: Typography.xs, color: theme.textMuted, marginBottom: 8, fontWeight: Typography.semiBold },
  chipWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, height: 32,
    borderRadius: Radius.full,
  },
  tagText:      { color: '#fff', fontSize: 13, fontWeight: Typography.semiBold, lineHeight: 18 },
  tagDeleteBtn: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  tagDeleteX: { color: '#fff', fontSize: 13, fontWeight: Typography.bold, lineHeight: 16 },
  noTagsText: { color: theme.textMuted, fontSize: Typography.xs, fontStyle: 'italic', paddingVertical: 4 },

  input: {
    borderWidth: 1, borderColor: theme.border, borderRadius: Radius.md,
    padding: 12, color: theme.textPrimary,
  },
  sheetBtn: { paddingVertical: 12, borderRadius: Radius.md },
});
