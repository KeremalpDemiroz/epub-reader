import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
  ActivityIndicator, Dimensions, Image, Animated, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useLibraryStore } from '../store/useLibraryStore';
import { useTimelineStore } from '../store/useTimelineStore';
import { loadEpubAndExtract } from '../services/EpubManager';
import { Typography, Spacing, Radius, Shadow, AppTheme } from '../theme';
import { useThemeStore } from '../store/useThemeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const FALLBACK_COLORS = ['#5B5FEF', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6'];
function getFallbackColor(id: string) {
  const sum = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return FALLBACK_COLORS[sum % FALLBACK_COLORS.length];
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { books, tags, addBook, removeBook, updateLastRead } = useLibraryStore();
  const { setActiveChapter } = useTimelineStore();
  const { theme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, insets.top);

  const [loading,  setLoading]  = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState('');
  const [toast,    setToast]    = useState<{ msg: string; color: string; textColor: string } | null>(null);
  const [toastAnim] = useState(new Animated.Value(0));

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const tapTimeouts = React.useRef<{ [key: string]: NodeJS.Timeout }>({});

  const sortedBooks = [...books]
    .filter(b => activeTags.length === 0 || activeTags.every(tagId => b.tagIds?.includes(tagId)))
    .sort((a, b) => (b.lastReadAt || b.importedAt) - (a.lastReadAt || a.importedAt));

  // ── Floating Toast ──────────────────────────────────────────
  const showToast = (msg: string, type: 'info' | 'error' | 'success' = 'info', ms = 4000) => {
    const color     = type === 'error' ? theme.danger : type === 'success' ? '#16A34A' : theme.surface;
    const textColor = type === 'info'  ? theme.textPrimary : '#fff';
    setToast({ msg, color, textColor });
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.delay(ms - 600),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  // ── Çift kayıt kontrolü (filename veya title'a göre) ────────
  const isDuplicate = (filename: string) => {
    const baseName = filename.replace(/\.epub$/i, '').toLowerCase();
    return books.some(b =>
      (b.filename?.toLowerCase() === filename.toLowerCase()) ||
      (b.title?.toLowerCase() === baseName)
    );
  };

  // ── Ortak import işleyicisi ────────────────────────────────
  const processAssets = async (assets: { uri: string; name: string }[]) => {
    const epubs = assets.filter(a => a.name.toLowerCase().endsWith('.epub'));
    if (epubs.length === 0) {
      showToast('Desteklenmeyen dosya türü. Sadece .epub kabul edilir.', 'error', 5000);
      return;
    }

    setLoading(true);
    let added = 0, skipped = 0, failed = 0;

    for (let i = 0; i < epubs.length; i++) {
      const { uri, name } = epubs[i];
      setProgress(`İşleniyor ${i + 1}/${epubs.length} — ${name}`);

      if (isDuplicate(name)) { skipped++; continue; }

      const bookId = `${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
      try {
        const extracted = await loadEpubAndExtract(uri, bookId);
        if (extracted.firstPagePath) {
          const firstChapterId = extracted.chapters?.[0]?.id ?? 'ch0';
          addBook({
            id:               bookId,
            filename:         name,
            title:            name.replace(/\.epub$/i, ''),
            firstPagePath:    extracted.firstPagePath,
            baseDir:          extracted.baseDir,
            importedAt:       Date.now(),
            lastReadAt:       Date.now(),
            chapters:         extracted.chapters,
            currentChapterId: firstChapterId,
            coverImagePath:   extracted.coverImagePath,
          });
          setActiveChapter(bookId, firstChapterId, extracted.firstPageHtml || '<p>İçerik Bulunamadı</p>');
          added++;
        } else { failed++; }
      } catch { failed++; }
    }

    setLoading(false);
    setProgress('');
    const parts = [
      added   > 0 ? `✅ ${added} eklendi`    : null,
      skipped > 0 ? `⏭ ${skipped} mevcuttu` : null,
      failed  > 0 ? `❌ ${failed} başarısız` : null,
    ].filter(Boolean).join('  ·  ');
    if (parts) showToast(parts, failed > 0 ? 'error' : 'success', 5500);
  };

  // ── + Ekle (Dosya Seçici) ──────────────────────────────────
  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true });
      if (!result.canceled && result.assets?.length > 0) {
        await processAssets(result.assets.map(a => ({ uri: a.uri, name: a.name ?? 'kitap.epub' })));
      }
    } catch { showToast('Dosya seçimi sırasında hata oluştu.', 'error'); }
  };

  // ── ⟳ SAF Klasör Tarama ───────────────────────────────────
  const handleScan = async () => {
    try {
      // ── Adım 1: Depolama okuma izni ──────────────────────────
      const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync(false);
      if (status !== 'granted') {
        if (!canAskAgain) {
          showToast('Depolama izni kalıcı olarak reddedildi. Ayarlar > Uygulama izinlerinden açabilirsiniz.', 'error', 6000);
        } else {
          showToast('Tarama için depolama okuma izni gerekli.', 'error');
        }
        return;
      }

      // ── Adım 2: Klasör seçimi (SAF) ──────────────────────────
      const SAF = FileSystem.StorageAccessFramework;
      setScanning(true);
      const perm = await SAF.requestDirectoryPermissionsAsync();
      if (!perm.granted) {
        setScanning(false);
        showToast('Klasör seçimi iptal edildi.', 'info');
        return;
      }
      showToast('Klasör taranıyor…', 'info', 60000);
      const found: { uri: string; name: string }[] = [];

      const scanDir = async (dirUri: string) => {
        try {
          const entries = await SAF.readDirectoryAsync(dirUri);
          for (const entry of entries) {
            const name = decodeURIComponent(entry).split('/').pop() || entry;
            if (name.toLowerCase().endsWith('.epub')) {
              found.push({ uri: entry, name });
            } else { try { await scanDir(entry); } catch {} }
          }
        } catch {}
      };

      await scanDir(perm.directoryUri);
      setScanning(false);
      setToast(null);
      if (found.length === 0) { showToast('Bu klasörde .epub bulunamadı.', 'info'); return; }
      await processAssets(found);
    } catch {
      setScanning(false);
      showToast('Klasör tarama hatası.', 'error');
    }
  };

  // ── Sil ──────────────────────────────────────────────────────
  const handleBulkDelete = () => {
    Alert.alert('Seçili Kitapları Sil', `${selectedBooks.length} kitap kalıcı silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => {
          selectedBooks.forEach(id => removeBook(id));
          setSelectionMode(false);
          setSelectedBooks([]);
      }},
    ]);
  };

  const toggleSelection = (id: string) => {
    setSelectedBooks(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const handleBookPress = (id: string) => {
    if (selectionMode) {
      toggleSelection(id);
      return;
    }
    
    if (tapTimeouts.current[id]) {
      // Çift tıklandı
      clearTimeout(tapTimeouts.current[id]);
      delete tapTimeouts.current[id];
      navigation.navigate('BookInfo' as never, { bookId: id } as never);
    } else {
      // İlk tıklandı, bekle
      tapTimeouts.current[id] = setTimeout(() => {
        delete tapTimeouts.current[id];
        updateLastRead(id);
        navigation.navigate('Reader' as never, { bookId: id } as never);
      }, 300);
    }
  };

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <View style={styles.screen}>

      {/* HEADER */}
      <View style={styles.header}>
        {selectionMode ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <TouchableOpacity 
                onPress={() => { setSelectionMode(false); setSelectedBooks([]); }} 
                style={[styles.iconBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
              >
                <Text style={[styles.iconBtnText, { color: theme.textSecondary }]}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{selectedBooks.length} Seçildi</Text>
            </View>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: '#EF4444' }]}
              onPress={handleBulkDelete}
              disabled={selectedBooks.length === 0}
            >
              <Text style={styles.addBtnText}>Sil</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.headerTitle}>Kitaplığım</Text>
            <View style={styles.headerBtns}>
              {/* ⟳ Tara */}
              <TouchableOpacity
                style={[styles.iconBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                onPress={handleScan}
                activeOpacity={0.75}
                disabled={loading || scanning}
              >
                {scanning
                  ? <ActivityIndicator size={15} color={theme.primary} />
                  : <Text style={[styles.iconBtnText, { color: theme.primary }]}>⟳</Text>}
              </TouchableOpacity>

              {/* + Ekle */}
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: theme.primary }]}
                onPress={handleImport}
                activeOpacity={0.8}
                disabled={loading || scanning}
              >
                {loading
                  ? <ActivityIndicator size={14} color="#fff" />
                  : <Text style={styles.addBtnText}>+ Ekle</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* İlerleme Bandı */}
      {!!progress && (
        <View style={[styles.progressBand, { backgroundColor: theme.primaryLight }]}>
          <Text style={[styles.progressText, { color: theme.primary }]} numberOfLines={1}>{progress}</Text>
        </View>
      )}

      {/* Etiket Filtreleme Barı */}
      {tags.length > 0 && (
        <View style={{ paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {activeTags.length > 0 && (
              <TouchableOpacity
                style={[styles.tagFilterBtn, { backgroundColor: theme.danger || '#EF4444', borderColor: 'transparent' }]}
                onPress={() => setActiveTags([])}
              >
                <Text style={[styles.tagFilterText, { color: '#fff' }]}>✕ Temizle</Text>
              </TouchableOpacity>
            )}
            {tags.map(t => {
              const isActive = activeTags.includes(t.id);
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.tagFilterBtn, isActive && { backgroundColor: t.color, borderColor: t.color }]}
                  onPress={() => setActiveTags(prev =>
                    isActive ? prev.filter(id => id !== t.id) : [...prev, t.id]
                  )}
                >
                  <Text style={[styles.tagFilterText, isActive && { color: '#fff' }]}>{t.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Kitap Listesi */}
      <FlatList
        data={sortedBooks}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => {
          const pct = item.chapters?.length && item.currentChapterId
            ? Math.round(((item.chapters.findIndex(c => c.id === item.currentChapterId) + 1) / item.chapters.length) * 100)
            : null;
          return (
            <TouchableOpacity
              style={[styles.bookCard, selectionMode && selectedBooks.includes(item.id) && { borderColor: theme.primary, borderWidth: 2 }]}
              onPress={() => handleBookPress(item.id)}
              onLongPress={() => {
                if (!selectionMode) {
                  setSelectionMode(true);
                  setSelectedBooks([item.id]);
                }
              }}
              activeOpacity={0.85}
            >
              {/* Seçim İşareti */}
              {selectionMode && selectedBooks.includes(item.id) && (
                <View style={styles.selectionCheck}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✓</Text>
                </View>
              )}

              {/* % Badge */}
              {pct !== null && (
                <View style={styles.pctBadge}>
                  <Text style={styles.pctBadgeText}>%{pct}</Text>
                </View>
              )}

              {/* Kapak */}
              {item.coverImagePath
                ? <Image source={{ uri: item.coverImagePath }} style={styles.coverImage} resizeMode="cover" />
                : (
                  <View style={[styles.coverFallback, { backgroundColor: getFallbackColor(item.id) }]}>
                    <Text style={styles.coverFallbackText}>{item.title[0]?.toUpperCase()}</Text>
                  </View>
                )}

              {/* Alt Bilgi */}
              <View style={styles.bookMeta}>
                <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={[styles.bookSub, { color: theme.primary }]}>
                  {item.chapters?.length ? `${item.chapters.length} bölüm` : 'Bölüm bilgisi yok'}
                </Text>
                <Text style={styles.bookDate}>
                  {item.lastReadAt
                    ? `📖 ${new Date(item.lastReadAt).toLocaleDateString('tr-TR')}`
                    : 'Henüz açılmadı'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📚</Text>
            <Text style={styles.emptyTitle}>Henüz kitap yok</Text>
            <Text style={styles.emptySub}>{"⟳"} Tara veya {"+ Ekle"} ile başlayın.</Text>
          </View>
        }
      />

      {/* Floating Temalı Toast */}
      {toast && (
        <Animated.View
          style={[
            styles.toast,
            {
              backgroundColor: toast.color,
              borderColor: theme.border,
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
            },
          ]}
        >
          <Text style={[styles.toastText, { color: toast.textColor }]}>{toast.msg}</Text>
        </Animated.View>
      )}
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────
const CARD_WIDTH  = (width - Spacing.base * 3) / 2;
const COVER_HEIGHT = CARD_WIDTH * 1.35;

const getStyles = (theme: AppTheme, statusBarHeight = 0) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingTop: statusBarHeight + Spacing.md, paddingBottom: Spacing.md,
    backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  headerTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: theme.textPrimary },
  headerBtns:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  iconBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, minWidth: 44, height: 38, ...Shadow.sm,
  },
  iconBtnText: { fontSize: 18, lineHeight: 20, fontWeight: Typography.bold },

  addBtn: {
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, minWidth: 76, alignItems: 'center', ...Shadow.sm,
  },
  addBtnText: { color: '#fff', fontWeight: Typography.bold, fontSize: Typography.sm },

  progressBand: { paddingHorizontal: Spacing.base, paddingVertical: 6 },
  progressText: { fontSize: Typography.xs, fontWeight: Typography.medium },

  listContent: { padding: Spacing.base, paddingBottom: Spacing.xxl },
  row:         { justifyContent: 'space-between', marginBottom: Spacing.base },

  bookCard: {
    width: CARD_WIDTH, backgroundColor: theme.surface,
    borderRadius: Radius.lg, overflow: 'visible', ...Shadow.md,
  },
  coverImage: { width: '100%', height: COVER_HEIGHT, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg },
  coverFallback: {
    width: '100%', height: COVER_HEIGHT,
    borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    justifyContent: 'center', alignItems: 'center',
  },
  coverFallbackText: { fontSize: 52, color: 'rgba(255,255,255,0.65)', fontWeight: Typography.extraBold },

  bookMeta:   { padding: Spacing.sm },
  bookTitle:  { fontSize: Typography.sm, fontWeight: Typography.bold, color: theme.textPrimary, marginBottom: 2 },
  bookSub:    { fontSize: 11, fontWeight: Typography.medium },
  bookDate:  { fontSize: Typography.xs, color: theme.textMuted },

  selectionCheck: {
    position: 'absolute', top: Spacing.sm, right: Spacing.sm, zIndex: 10,
    backgroundColor: theme.primary, width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', ...Shadow.sm
  },

  pctBadge: {
    position: 'absolute', bottom: 92, right: 8, zIndex: 5,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.sm,
  },
  pctBadgeText: { color: '#fff', fontSize: 10, fontWeight: Typography.bold },

  emptyContainer: { alignItems: 'center', paddingTop: Spacing.xxl * 2 },
  emptyEmoji:     { fontSize: 60, marginBottom: Spacing.base },
  emptyTitle:     { fontSize: Typography.lg, fontWeight: Typography.semiBold, color: theme.textSecondary, marginBottom: Spacing.sm },
  emptySub:       { fontSize: Typography.sm, color: theme.textMuted, textAlign: 'center', lineHeight: 22 },

  toast: {
    position: 'absolute', bottom: 32, left: 20, right: 20,
    borderRadius: 20, borderWidth: 1.5,
    paddingHorizontal: 20, paddingVertical: 14,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 14,
  },
  toastText: { fontSize: Typography.sm, fontWeight: Typography.medium, textAlign: 'center', lineHeight: 20 },

  tagFilterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  tagFilterText: {
    fontSize: 13,
    fontWeight: Typography.medium,
    color: theme.textSecondary,
  },
});
