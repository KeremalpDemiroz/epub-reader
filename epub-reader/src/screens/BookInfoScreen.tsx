import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, Modal, TextInput, FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryStore } from '../store/useLibraryStore';
import { useThemeStore } from '../store/useThemeStore';
import { AppTheme, Spacing, Typography, Radius, Shadow } from '../theme';

type RootStackParamList = {
  DrawerRoot: undefined;
  Reader: { bookId: string };
  BookInfo: { bookId: string };
};
type Props = NativeStackScreenProps<RootStackParamList, 'BookInfo'>;

export default function BookInfoScreen({ route, navigation }: Props) {
  const { bookId } = route.params;
  const book         = useLibraryStore(s => s.getBook(bookId));
  const tags         = useLibraryStore(s => s.tags);
  const addTag       = useLibraryStore(s => s.addTag);
  const removeTag    = useLibraryStore(s => s.removeTag);
  const toggleBookTag = useLibraryStore(s => s.toggleBookTag);
  const { theme }    = useThemeStore();
  const insets       = useSafeAreaInsets();
  const styles       = getStyles(theme);

  const [showChapters,   setShowChapters]   = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showNewTagInput,setShowNewTagInput] = useState(false);
  const [newTagName,     setNewTagName]     = useState('');

  if (!book) return null;

  const bookTags      = tags.filter(t => book.tagIds?.includes(t.id));
  const totalChapters = book.chapters?.length || 0;
  const currentIndex  = book.chapters?.findIndex(c => c.id === book.currentChapterId) ?? -1;
  const pct = totalChapters > 0 && currentIndex >= 0
    ? Math.round(((currentIndex + 1) / totalChapters) * 100)
    : 0;

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
    navigation.replace('Reader', { bookId });
  };

  // ── Header kısmı (Cover + badge) ──────────────────────────────
  const renderHeader = () => (
    <>
      {/* Kapak */}
      <View style={[styles.topSection, { paddingTop: insets.top + Spacing.md }]}>
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 8 }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.coverWrapper}>
          {book.coverImagePath ? (
            <Image source={{ uri: book.coverImagePath }} style={styles.coverImage} />
          ) : (
            <View style={[styles.coverImage, { backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={styles.coverFallback}>{book.title[0]?.toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.pctBadge}>
            <Text style={styles.pctBadgeText}>%{pct}</Text>
          </View>
        </View>
      </View>

      {/* Alt dock – meta */}
      <View style={styles.bottomDock}>
        <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
        <Text style={styles.dateText}>
          Eklenme: {new Date(book.importedAt).toLocaleDateString('tr-TR')}
        </Text>
        <Text style={styles.dateText}>
          Son Okuma: {book.lastReadAt
            ? new Date(book.lastReadAt).toLocaleDateString('tr-TR')
            : 'Hiç okunmadı'}
        </Text>

        {/* Bölüm butonu */}
        <TouchableOpacity
          style={styles.chapterDrawerBtn}
          onPress={() => setShowChapters(v => !v)}
        >
          <Text style={styles.chapterDrawerText}>
            Bölüm Listesi ({totalChapters}) {showChapters ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // ── Footer kısmı (Etiketler) ────────────────────────────────────
  const renderFooter = () => (
    <View style={[styles.bottomDock, { marginTop: 0, borderTopWidth: 0, paddingTop: 0 }]}>
      <View style={styles.tagsSection}>
        <View style={styles.tagsHeader}>
          <Text style={styles.tagsSectionTitle}>Etiketler</Text>
          <TouchableOpacity
            style={[styles.manageTagBtn, { backgroundColor: theme.primaryLight }]}
            onPress={() => setShowTagManager(true)}
          >
            <Text style={[styles.manageTagBtnText, { color: theme.primary }]}>+ Yönet</Text>
          </TouchableOpacity>
        </View>

        {bookTags.length === 0 ? (
          <Text style={styles.noTagsText}>Henüz etiket eklenmedi.</Text>
        ) : (
          <View style={styles.tagsRow}>
            {bookTags.map(t => (
              <View key={t.id} style={[styles.tag, { backgroundColor: t.color }]}>
                <Text style={styles.tagText}>{t.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      {showChapters ? (
        // Bölüm listesi açıkken FlatList tek başına yönetir
        <FlatList
          data={book.chapters}
          keyExtractor={ch => ch.id}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
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
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ backgroundColor: theme.background }}
        />
      ) : (
        // Bölüm listesi kapalıyken düz ScrollView yeterli
        <ScrollView contentContainerStyle={{ backgroundColor: theme.background }}>
          {renderHeader()}
          {renderFooter()}
        </ScrollView>
      )}

      {/* ── ETİKET YÖNETİCİSİ ── */}
      <Modal
        visible={showTagManager}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTagManager(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Etiket Yönetimi</Text>
            <Text style={styles.modalSubtitle}>Seçili (✓) etiketler bu kitaba atanmış.</Text>

            <FlatList
              data={tags}
              keyExtractor={t => t.id}
              style={{ maxHeight: 280, marginBottom: 12 }}
              renderItem={({ item: t }) => {
                const isAssigned = book.tagIds?.includes(t.id);
                return (
                  <TouchableOpacity
                    style={styles.tagManagerRow}
                    onPress={() => toggleBookTag(bookId, t.id)}
                  >
                    <View style={[styles.tagDot, { backgroundColor: t.color }]} />
                    <Text style={[styles.tagManagerText, isAssigned && { color: theme.textPrimary, fontWeight: 'bold' }]}>
                      {t.name}
                    </Text>
                    <View style={{ flex: 1 }} />
                    {isAssigned && (
                      <Text style={{ color: theme.primary, fontSize: 18, marginRight: 8 }}>✓</Text>
                    )}
                    <TouchableOpacity
                      onPress={() => removeTag(t.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={{ color: theme.textMuted, fontSize: 16 }}>🗑</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.noTagsText}>Henüz hiç etiket oluşturulmadı.</Text>
              }
            />

            {showNewTagInput ? (
              <View>
                <TextInput
                  style={styles.input}
                  placeholder="Etiket adı..."
                  placeholderTextColor={theme.textMuted}
                  value={newTagName}
                  onChangeText={setNewTagName}
                  autoFocus
                />
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { flex: 1, borderWidth: 1, borderColor: theme.border }]}
                    onPress={() => { setShowNewTagInput(false); setNewTagName(''); }}
                  >
                    <Text style={{ color: theme.textSecondary, textAlign: 'center', fontWeight: Typography.medium }}>
                      İptal
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { flex: 1, backgroundColor: theme.primary }]}
                    onPress={handleCreateTag}
                  >
                    <Text style={{ color: '#fff', textAlign: 'center', fontWeight: Typography.semiBold }}>
                      Oluştur
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
                onPress={() => setShowNewTagInput(true)}
              >
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: Typography.semiBold }}>
                  + Yeni Etiket Oluştur
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.modalBtn, { marginTop: 8, borderWidth: 1, borderColor: theme.border }]}
              onPress={() => { setShowTagManager(false); setShowNewTagInput(false); setNewTagName(''); }}
            >
              <Text style={{ color: theme.textSecondary, textAlign: 'center', fontWeight: Typography.medium }}>
                Kapat
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },

  topSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: Radius.full,
    ...Shadow.sm,
    zIndex: 10,
  },
  backBtnText: { fontSize: 32, color: theme.textPrimary, lineHeight: 36, marginTop: -2 },
  coverWrapper: { position: 'relative', ...Shadow.lg },
  coverImage: { width: 180, height: 260, borderRadius: Radius.lg },
  coverFallback: { fontSize: 60, color: 'rgba(255,255,255,0.7)', fontWeight: Typography.bold },
  pctBadge: {
    position: 'absolute', top: -10, right: -10,
    backgroundColor: '#F87171',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Radius.sm, ...Shadow.sm,
  },
  pctBadgeText: { color: '#fff', fontWeight: Typography.bold, fontSize: 12 },

  bottomDock: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: Spacing.xl, paddingBottom: Spacing.lg,
    ...Shadow.lg,
  },
  title: { fontSize: Typography.lg, fontWeight: Typography.bold, color: theme.textPrimary, marginBottom: 4 },
  dateText: { fontSize: Typography.xs, color: theme.textMuted, marginBottom: 4 },

  chapterDrawerBtn: {
    borderWidth: 1, borderColor: theme.border, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
    marginTop: Spacing.md,
  },
  chapterDrawerText: { color: theme.textPrimary, fontWeight: Typography.medium },

  // Bölüm satırları — FlatList item olarak render edilir
  chapterItem: {
    padding: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  chapterItemText: { color: theme.textPrimary, fontSize: Typography.sm },

  tagsSection: { },
  tagsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  tagsSectionTitle: { fontSize: Typography.sm, fontWeight: Typography.semiBold, color: theme.textSecondary },
  manageTagBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full },
  manageTagBtnText: { fontSize: 12, fontWeight: Typography.semiBold },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full },
  tagText: { color: '#fff', fontSize: 13, fontWeight: Typography.semiBold },
  noTagsText: { color: theme.textMuted, fontSize: Typography.xs, fontStyle: 'italic' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, ...Shadow.lg,
  },
  modalTitle: { fontSize: Typography.md, fontWeight: Typography.bold, color: theme.textPrimary, marginBottom: 4 },
  modalSubtitle: { fontSize: Typography.xs, color: theme.textMuted, marginBottom: 16 },
  tagManagerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, gap: 10,
    borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  tagDot: { width: 14, height: 14, borderRadius: 7 },
  tagManagerText: { fontSize: Typography.sm, color: theme.textSecondary },
  input: {
    borderWidth: 1, borderColor: theme.border, borderRadius: Radius.md,
    padding: 12, color: theme.textPrimary, marginTop: 12,
  },
  modalBtn: { paddingVertical: 12, borderRadius: Radius.md },
});
