import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
  ActivityIndicator, Image, Animated, ScrollView, TextInput,
  BackHandler, useWindowDimensions, Platform, Linking
} from 'react-native';
import { useNavigation, useRoute, DrawerActions, useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useLibraryStore } from '../store/useLibraryStore';
import { useTimelineStore } from '../store/useTimelineStore';
import { loadEpubAndExtract } from '../services/EpubManager';
import { Typography, Spacing, Radius, Shadow, AppTheme } from '../theme';
import { useThemeStore } from '../store/useThemeStore';
import { useProgressStore } from '../store/useProgressStore';
import { useDockAlert } from '../components/DockAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scanDeviceForEpubs, scanDeviceForEpubsSAF } from '../services/ScannerService';
import { exportBookWithLatestVersions } from '../services/ExportService';

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
  const { isMerging, mergeProgress, mergeProgressValue } = useProgressStore();
  const { showAlert, alertElement } = useDockAlert();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const styles = getStyles(theme, insets.top, width);

  const [loading,  setLoading]  = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState('');
  const [toast,    setToast]    = useState<{ msg: string; color: string; textColor: string } | null>(null);
  const [toastAnim] = useState(new Animated.Value(0));

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [activeTags, setActiveTags]       = useState<string[]>([]);
  const [searchQuery, setSearchQuery]     = useState('');
  const [showSearch,  setShowSearch]      = useState(false);
  const [mergeMode,   setMergeMode]       = useState(false);

  const tapTimeouts = React.useRef<{ [key: string]: NodeJS.Timeout }>({});
  const route = useRoute<any>();

  // Drawer'dan gelen mergeMode paramı
  useEffect(() => {
    if (route.params?.mergeMode) {
      setMergeMode(true);
      setSelectionMode(true);
      setSelectedBooks([]);
      // Param'ı temizle (tekrar tetiklenmesini önle)
      navigation.setParams({ mergeMode: undefined });
    }
  }, [route.params?.mergeMode]);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (selectionMode || mergeMode) {
          setSelectionMode(false);
          setMergeMode(false);
          setSelectedBooks([]);
          return true; // prevent default behavior
        }
        if (showSearch) {
          setShowSearch(false);
          setSearchQuery('');
          return true;
        }
        return false;
      };
      
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [selectionMode, showSearch, mergeMode])
  );

  const sortedBooks = [...books]
    .filter(b => {
      const matchQuery = searchQuery.trim() === '' || b.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTags  = activeTags.length === 0 || activeTags.every(tagId => b.tagIds?.includes(tagId));
      return matchQuery && matchTags;
    })
    .sort((a, b) => (b.lastReadAt || b.importedAt) - (a.lastReadAt || a.importedAt));

  // ── Floating Toast ──────────────────────────────────────────
  const showToast = (msg: string, type: 'info' | 'error' | 'success' = 'info', ms = 4000) => {
    console.log(`[Home][Toast][${type}] ${msg}`);
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
    console.log(`[Home][Import] processAssets başladı — ${assets.length} dosya`);
    const epubs = assets.filter(a => a.name.toLowerCase().endsWith('.epub'));
    if (epubs.length === 0) {
      showToast('Desteklenmeyen dosya türü. Sadece .epub kabul edilir.', 'error', 5000);
      return;
    }
    console.log(`[Home][Import] ${epubs.length} epub bulundu, işleniyor...`);
    setLoading(true);
    let added = 0, skipped = 0, failed = 0;

    for (let i = 0; i < epubs.length; i++) {
      const { uri, name } = epubs[i];
      console.log(`[Home][Import] ${i+1}/${epubs.length}: ${name} (${uri.substring(0,80)}...)`);
      setProgress(`İşleniyor ${i + 1}/${epubs.length} — ${name}`);

      if (isDuplicate(name)) { console.log(`[Home][Import] SKIP (duplicate): ${name}`); skipped++; continue; }

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
          console.log(`[Home][Import] OK: ${name} → ${extracted.chapters?.length || 0} bölüm`);
          added++;
        } else { console.log(`[Home][Import] FAIL (no firstPage): ${name}`); failed++; }
      } catch (e: any) { console.log(`[Home][Import] ERROR: ${name}`, e?.message); failed++; }
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
    console.log('[Home][Import] DocumentPicker açılıyor...');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/epub+zip', multiple: true });
      console.log(`[Home][Import] Picker sonuç: canceled=${result.canceled}, assets=${result.assets?.length || 0}`);
      if (!result.canceled && result.assets?.length > 0) {
        await processAssets(result.assets.map(a => ({ uri: a.uri, name: a.name ?? 'kitap.epub' })));
      }
    } catch (e: any) { console.log('[Home][Import] Picker HATA:', e?.message); showToast('Dosya seçimi sırasında hata oluştu.', 'error'); }
  };

  // ── Depolama erişim kontrolü ────────────────────────────────
  const checkStorageAccess = async (): Promise<boolean> => {
    try {
      await FileSystem.readDirectoryAsync('file:///storage/emulated/0');
      console.log('[Home][Permission] Depolama erişimi: VAR');
      return true;
    } catch (e: any) {
      console.log('[Home][Permission] Depolama erişimi: YOK —', e?.message);
      return false;
    }
  };

  const requestAllFilesAccess = async () => {
    if (Platform.OS !== 'android') return;
    try {
      const IntentLauncher = require('expo-intent-launcher');
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
        { data: 'package:com.keremalpdemiroz.epubreader' }
      );
    } catch {
      try {
        const IntentLauncher = require('expo-intent-launcher');
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.MANAGE_ALL_FILES_ACCESS_PERMISSION
        );
      } catch {
        Linking.openSettings();
      }
    }
  };

  // ── ⟳ Cihazı Tara (Tüm Sistem) ───────────────────────────
  const handleScan = async () => {
    console.log('[Home][Scan] Tarama başlatılıyor...');
    try {
      // 1. Dosya sistemi erişim kontrolü
      let hasAccess = await checkStorageAccess();
      
      if (!hasAccess) {
        showToast('Dosya erişim izni gerekli, ayar sayfası açılıyor...', 'info', 3000);
        await requestAllFilesAccess();
        // Kullanıcı geri döndü — tekrar kontrol
        hasAccess = await checkStorageAccess();
        if (!hasAccess) {
          showToast('Dosya erişim izni verilmedi.', 'error');
          return;
        }
      }

      // 2. Tara
      setScanning(true);
      showToast('Cihaz taranıyor, bu işlem biraz sürebilir...', 'info', 60000);
      
      const found = await scanDeviceForEpubs('file:///storage/emulated/0', (dir) => {
        setProgress(`Taranıyor: ${dir}`);
      });
      
      setScanning(false);
      setToast(null);
      setProgress('');
      
      if (found.length === 0) {
        console.log('[Home][Scan] Direkt taramada bulunamadı, SAF klasör seçici açılıyor...');
        showToast('Erişilebilir klasörlerde .epub bulunamadı. Epub klasörünüzü seçin.', 'info', 4000);
        
        // SAF ile kullanıcıdan klasör seçmesini iste
        try {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            console.log(`[Home][Scan] SAF klasör seçildi: ${permissions.directoryUri}`);
            setScanning(true);
            showToast('Seçilen klasör taranıyor...', 'info', 60000);
            const safFound = await scanDeviceForEpubsSAF(permissions.directoryUri, (dir) => {
              setProgress('Taranıyor...');
            });
            setScanning(false);
            setToast(null);
            setProgress('');
            console.log(`[Home][Scan] SAF tarama sonucu: ${safFound.length} epub`);
            if (safFound.length === 0) {
              showToast('Seçilen klasörde de .epub bulunamadı.', 'info');
            } else {
              await processAssets(safFound);
            }
          } else {
            console.log('[Home][Scan] SAF klasör seçimi iptal edildi');
          }
        } catch (e: any) {
          console.log('[Home][Scan] SAF hata:', e?.message);
        }
        return; 
      }
      
      await processAssets(found);
    } catch {
      setScanning(false);
      setProgress('');
      showToast('Cihaz tarama hatası.', 'error');
    }
  };

  // ── Sil ──────────────────────────────────────────────────────
  const handleBulkDelete = () => {
    console.log(`[Home][Delete] ${selectedBooks.length} kitap silinecek:`, selectedBooks);
    showAlert('Seçili Kitapları Sil', `${selectedBooks.length} kitap kalıcı silinsin mi?`, [
      { text: 'Vazgeç', style: 'cancel', onPress: () => console.log('[Home][Delete] İptal edildi') },
      { text: 'Sil', style: 'destructive', onPress: () => {
          console.log('[Home][Delete] Silme onaylandı');
          selectedBooks.forEach(id => removeBook(id));
          setSelectionMode(false);
          setSelectedBooks([]);
      }},
    ]);
  };

  const handleExport = async () => {
    if (selectedBooks.length !== 1) return;
    console.log(`[Home][Export] Dışa aktarılıyor: ${selectedBooks[0]}`);
    setLoading(true);
    showToast('Dışa aktarılıyor...', 'info', 60000);
    const success = await exportBookWithLatestVersions(selectedBooks[0]);
    console.log(`[Home][Export] Sonuç: ${success ? 'BAŞARILI' : 'BAŞARISIZ'}`);
    setLoading(false);
    if (success) {
      setToast(null);
      setSelectionMode(false);
      setSelectedBooks([]);
    } else {
      showToast('Dışa aktarma sırasında bir hata oluştu.', 'error');
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedBooks(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const handleBookPress = (id: string) => {
    if (selectionMode) {
      console.log(`[Home][Select] Kitap seçim toggle: ${id}`);
      toggleSelection(id);
      return;
    }
    
    if (tapTimeouts.current[id]) {
      // Çift tıklandı
      clearTimeout(tapTimeouts.current[id]);
      delete tapTimeouts.current[id];
      console.log(`[Home][Nav] Çift tık → BookInfo: ${id}`);
      navigation.navigate('BookInfo' as never, { bookId: id } as never);
    } else {
      // İlk tıklandı, bekle
      tapTimeouts.current[id] = setTimeout(() => {
        delete tapTimeouts.current[id];
        console.log(`[Home][Nav] Tek tık → Reader: ${id}`);
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
                onPress={() => { setSelectionMode(false); setMergeMode(false); setSelectedBooks([]); }} 
                style={[styles.iconBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
              >
                <Text style={[styles.iconBtnText, { color: theme.textSecondary }]}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{selectedBooks.length} Seçildi</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              {mergeMode ? (
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: theme.primary, opacity: selectedBooks.length < 2 ? 0.4 : 1 }]}
                  onPress={() => {
                    if (selectedBooks.length < 2) return;
                    setSelectionMode(false);
                    setMergeMode(false);
                    navigation.navigate('MergeOrder', { bookIds: selectedBooks });
                    setSelectedBooks([]);
                  }}
                  disabled={selectedBooks.length < 2}
                >
                  <Text style={styles.addBtnText}>Devam ({selectedBooks.length})</Text>
                </TouchableOpacity>
              ) : (
                <>
                  {selectedBooks.length === 1 && (
                    <TouchableOpacity
                      style={[styles.addBtn, { backgroundColor: theme.primary }]}
                      onPress={handleExport}
                    >
                      <Text style={styles.addBtnText}>Dışa Aktar</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: '#EF4444' }]}
                    onPress={handleBulkDelete}
                    disabled={selectedBooks.length === 0}
                  >
                    <Text style={styles.addBtnText}>Sil</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
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
      {(!!progress || !!mergeProgress) && (
        <View style={{ backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <View style={[styles.progressBand, { backgroundColor: theme.primaryLight, flexDirection: 'row', alignItems: 'center' }]}>
            <Text style={[styles.progressText, { color: theme.primary, flex: 1 }]} numberOfLines={1}>
              {progress || mergeProgress}
            </Text>
            {isMerging && <ActivityIndicator size="small" color={theme.primary} style={{ marginLeft: 8 }} />}
          </View>
          {isMerging && mergeProgressValue !== undefined && (
            <View style={{ height: 3, backgroundColor: theme.border, width: '100%' }}>
              <View style={{ height: '100%', backgroundColor: theme.primary, width: `${Math.min(100, Math.max(0, mergeProgressValue))}%` }} />
            </View>
          )}
        </View>
      )}

      {/* Arama + Etiket Paneli */}
      {!selectionMode && (
        <View style={styles.searchPanel}>
          {/* Arama satırı */}
          <View style={styles.searchRow}>
            <View style={[styles.searchInputWrap, showSearch && { flex: 1 }]}>
              {showSearch ? (
                <TextInput
                  style={styles.searchInput}
                  placeholder="Kitap ara..."
                  placeholderTextColor={theme.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
              ) : (
                <TouchableOpacity style={styles.searchIconBtn} onPress={() => setShowSearch(true)}>
                  <Text style={{ fontSize: 16, color: theme.textSecondary }}>&#128269;</Text>
                </TouchableOpacity>
              )}
            </View>
            {showSearch && (
              <TouchableOpacity
                style={styles.searchCancelBtn}
                onPress={() => { setShowSearch(false); setSearchQuery(''); }}
              >
                <Text style={{ color: theme.textSecondary, fontWeight: Typography.medium }}>Kapat</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Etiket Filtreleri */}
          {(tags.length > 0 || activeTags.length > 0) && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagFilterRow}>
              {activeTags.length > 0 && (
                <TouchableOpacity
                  style={[styles.tagFilterChip, { backgroundColor: '#EF4444', borderColor: 'transparent' }]}
                  onPress={() => setActiveTags([])}
                >
                  <Text style={[styles.tagFilterChipText, { color: '#fff' }]}>✕ Temizle</Text>
                </TouchableOpacity>
              )}
              {tags.map(t => {
                const isActive = activeTags.includes(t.id);
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.tagFilterChip, isActive && { backgroundColor: t.color, borderColor: t.color }]}
                    onPress={() => setActiveTags(prev =>
                      isActive ? prev.filter(id => id !== t.id) : [...prev, t.id]
                    )}
                  >
                    <Text style={[styles.tagFilterChipText, isActive && { color: '#fff' }]}>{t.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
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

              {/* Kapak */}
              {item.coverImagePath
                ? <Image source={{ uri: item.coverImagePath }} style={styles.coverImage} resizeMode="cover" />
                : (
                  <View style={[styles.coverFallback, { backgroundColor: getFallbackColor(item.id) }]}>
                    <Text style={styles.coverFallbackText}>{item.title[0]?.toUpperCase()}</Text>
                  </View>
                )}

              {/* Alt Bilgi + % Badge */}
              <View style={[styles.bookMeta, { position: 'relative' }]}>
                <Text style={styles.bookTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={[styles.bookSub, { color: theme.primary }]}>
                  {item.chapters?.length ? `${item.chapters.length} bölüm` : 'Bölüm bilgisi yok'}
                </Text>
                <Text style={styles.bookDate}>
                  {item.lastReadAt
                    ? `📖 ${new Date(item.lastReadAt).toLocaleDateString('tr-TR')}`
                    : 'Henüz açılmadı'}
                </Text>
                {pct !== null && (
                  <Text style={styles.pctBadgeText}>%{pct}</Text>
                )}
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

      {alertElement}
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────

const getStyles = (theme: AppTheme, statusBarHeight = 0, width: number) => {
  const CARD_WIDTH  = (width - Spacing.base * 3) / 2;
  const COVER_HEIGHT = CARD_WIDTH * 1.35;

  return StyleSheet.create({
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

    pctBadgeText: {
      position: 'absolute', bottom: 4, right: 6, zIndex: 5,
      color: theme.primary, fontSize: 13, fontWeight: Typography.bold,
    },

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

    tagFilterChip: {
      paddingHorizontal: 14, paddingVertical: 6, height: 32,
      borderRadius: Radius.full, borderWidth: 1, borderColor: theme.border,
      backgroundColor: theme.surface, justifyContent: 'center',
    },
    tagFilterChipText: {
      fontSize: 13, fontWeight: Typography.medium, color: theme.textSecondary,
    },

    // Arama paneli
    searchPanel: {
      borderBottomWidth: 1, borderBottomColor: theme.border,
      paddingBottom: Spacing.sm,
    },
    searchRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, gap: Spacing.sm,
    },
    searchInputWrap: {
      height: 36, backgroundColor: theme.surface,
      borderRadius: Radius.full, borderWidth: 1, borderColor: theme.border,
      flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
    },
    searchIconBtn: {
      paddingHorizontal: 14, height: '100%',
      justifyContent: 'center', alignItems: 'center',
    },
    searchInput: {
      flex: 1, paddingHorizontal: 14, color: theme.textPrimary,
      fontSize: Typography.sm, height: '100%',
    },
    searchCancelBtn: {
      paddingHorizontal: 4,
    },
    tagFilterRow: {
      paddingHorizontal: Spacing.base, paddingTop: Spacing.sm,
      gap: 8, alignItems: 'center',
    },
  });
};
