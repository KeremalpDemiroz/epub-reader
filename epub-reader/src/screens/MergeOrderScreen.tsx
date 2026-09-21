import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert,
  ActivityIndicator, Dimensions, Modal, FlatList, BackHandler, TextInput
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../store/useThemeStore';
import { useProgressStore } from '../store/useProgressStore';
import { useLibraryStore, Book } from '../store/useLibraryStore';
import { mergeBooks } from '../services/MergeService';
import { loadEpubAndExtract } from '../services/EpubManager';
import { Typography, Spacing, Radius, Shadow } from '../theme';
import { useDockAlert } from '../components/DockAlert';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const FALLBACK_COLORS = ['#5B5FEF', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6'];
function getFallbackColor(id: string) {
  const sum = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return FALLBACK_COLORS[sum % FALLBACK_COLORS.length];
}

export default function MergeOrderScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { theme, enableHaptics } = useThemeStore();
  const { getBook, addBook } = useLibraryStore();
  const { setMergeState } = useProgressStore();
  const { showAlert, alertElement } = useDockAlert();

  const initialIds: string[] = route.params?.bookIds || [];
  const [orderedIds, setOrderedIds] = useState<string[]>(initialIds);
  const [loading, setLoading] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [coverCandidates, setCoverCandidates] = useState<Book[]>([]);

  const books = orderedIds.map(id => getBook(id)).filter(Boolean) as Book[];
  const [mergedTitle, setMergedTitle] = useState(books.map(b => b.title).join(' + ').substring(0, 50));

  // Geri tuşu
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (loading) return true;
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [loading])
  );

  const handleMerge = async (coverBookId?: string) => {
    // Önce SAF izni al (UI thread bloklanmasın diye arka plana geçmeden sorulmalı)
    const SAF = FileSystem.StorageAccessFramework;
    const permissions = await SAF.requestDirectoryPermissionsAsync();
    
    if (!permissions.granted) {
      showAlert('İptal', 'Kayıt dizini seçilmediği için işlem iptal edildi.');
      return;
    }

    const fileName = (mergedTitle || 'Birleşik Kitap').replace(/[^a-zA-Z0-9\sğüşıöçĞÜŞİÖÇ]/g, '').trim() + '.epub';

    // İşlemi arka planda başlat
    setMergeState(true, 'Birleştirme başlatılıyor...', 0);
    navigation.navigate('Home');

    // Asenkron görev (UI donmasın diye gecikmeli başlar)
    setTimeout(async () => {
      try {
        const outputPath = await mergeBooks(orderedIds, coverBookId, mergedTitle, (msg, value) => {
          setMergeState(true, msg, value);
        });

        if (!outputPath) {
          setMergeState(false, '');
          showAlert('Hata', 'Birleştirme başarısız.');
          return;
        }

        setMergeState(true, 'Cihaza kaydediliyor...', 100);
        const savedUri = await SAF.createFileAsync(permissions.directoryUri, fileName, 'application/epub+zip');
        const b64 = await FileSystem.readAsStringAsync(outputPath, { encoding: 'base64' });
        await SAF.writeAsStringAsync(savedUri, b64, { encoding: 'base64' });
        
        setMergeState(true, 'Kütüphaneye ekleniyor...', 100);
        try {
          const bookId = 'book_' + Date.now();
          const parsed = await loadEpubAndExtract(outputPath, bookId);
          addBook({
            id: bookId,
            filename: fileName,
            title: mergedTitle || 'Birleşik Kitap',
            firstPagePath: parsed.firstPagePath || '',
            baseDir: parsed.baseDir,
            importedAt: Date.now(),
            chapters: parsed.chapters,
            coverImagePath: parsed.coverImagePath,
            currentChapterId: parsed.chapters?.[0]?.id,
          });
          
          await FileSystem.deleteAsync(outputPath, { idempotent: true });
          
          setMergeState(false, '');
          showAlert('Başarılı', 'Birleştirilmiş kitap kaydedildi ve kütüphaneye eklendi.');
        } catch (err) {
          setMergeState(false, '');
          showAlert('Kısmen Başarılı', 'Kitap kaydedildi ancak kütüphaneye eklenirken sorun oluştu.');
        }
      } catch (e) {
        console.error('Birleştirme hatası:', e);
        setMergeState(false, '');
        showAlert('Hata', 'Birleştirme sırasında bir sorun oluştu.');
      }
    }, 500); // UI geçişinin tamamlanması için bekle
  };

  const startMerge = () => {
    // Kapak tespiti
    const withCover = books.filter(b => b.coverImagePath);

    if (withCover.length === 0) {
      showAlert('Birleştir', `${books.length} kitap birleştirilsin mi?`, [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Birleştir', onPress: () => handleMerge() },
      ]);
    } else if (withCover.length === 1) {
      showAlert('Birleştir', `${books.length} kitap birleştirilsin mi?\nKapak: ${withCover[0].title}`, [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Birleştir', onPress: () => handleMerge(withCover[0].id) },
      ]);
    } else {
      setCoverCandidates(withCover);
      setShowCoverPicker(true);
    }
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<string>) => {
    const book = getBook(item);
    if (!book) return null;
    const idx = orderedIds.indexOf(item);

    return (
      <ScaleDecorator>
        <TouchableOpacity
          activeOpacity={0.7}
          onLongPress={drag}
          disabled={isActive}
          style={[
            styles.row,
            {
              backgroundColor: isActive ? theme.primaryLight : theme.surface,
              borderColor: isActive ? theme.primary : theme.border,
            },
          ]}
        >
          <View style={[styles.orderBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.orderText}>{idx + 1}</Text>
          </View>

          {book.coverImagePath ? (
            <Image source={{ uri: book.coverImagePath }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: getFallbackColor(book.id) }]}>
              <Text style={styles.thumbLetter}>{book.title[0]?.toUpperCase()}</Text>
            </View>
          )}

          <View style={styles.rowInfo}>
            <Text style={[styles.rowTitle, { color: theme.textPrimary }]} numberOfLines={2}>{book.title}</Text>
            <Text style={[styles.rowSub, { color: theme.textMuted }]}>
              {book.chapters?.length || 0} bölüm
            </Text>
          </View>

          <Text style={[styles.dragHandle, { color: theme.textMuted }]}>⠿</Text>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  return (
    <GestureHandlerRootView style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading}>
          <Text style={[styles.backBtn, { color: theme.textPrimary }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Sıralama</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={{ paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.sm }}>
        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Yeni Kitap Adı:</Text>
        <TextInput
          style={[styles.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface }]}
          value={mergedTitle}
          onChangeText={setMergedTitle}
          placeholder="Kitap Adı"
          placeholderTextColor={theme.textMuted}
        />
        <Text style={[styles.hint, { color: theme.textMuted, marginTop: Spacing.sm }]}>
          Basılı tutup sürükleyerek bölüm sırasını ayarlayın
        </Text>
      </View>

      {/* Sıralama listesi */}
      <DraggableFlatList
        data={orderedIds}
        keyExtractor={item => item}
        renderItem={renderItem}
        onDragBegin={() => {
          if (enableHaptics) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }}
        onDragEnd={({ data }) => setOrderedIds(data)}
        containerStyle={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: Spacing.base, paddingBottom: 100 }}
      />

      {/* Alt buton */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 8, backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} />
        ) : (
          <TouchableOpacity
            style={[styles.mergeBtn, { backgroundColor: theme.primary }]}
            onPress={() => {
              if (enableHaptics) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              startMerge();
            }}
          >
            <Text style={styles.mergeBtnText}>Birleştir ({books.length} kitap)</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Kapak seçim modalı */}
      <Modal visible={showCoverPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Kapak Görseli Seç</Text>
            <FlatList
              data={coverCandidates}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.coverOption, { borderColor: theme.border }]}
                  onPress={() => {
                    setShowCoverPicker(false);
                    showAlert('Birleştir', `${books.length} kitap birleştirilsin mi?`, [
                      { text: 'Vazgeç', style: 'cancel' },
                      { text: 'Birleştir', onPress: () => handleMerge(item.id) },
                    ]);
                  }}
                >
                  {item.coverImagePath && (
                    <Image source={{ uri: item.coverImagePath }} style={styles.coverThumb} />
                  )}
                  <Text style={[styles.coverLabel, { color: theme.textPrimary }]} numberOfLines={1}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: theme.border }]}
              onPress={() => setShowCoverPicker(false)}
            >
              <Text style={{ color: theme.textSecondary }}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {alertElement}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: { fontSize: 32, lineHeight: 36 },
  headerTitle: { fontSize: Typography.lg, fontWeight: Typography.bold },
  
  inputLabel: { fontSize: Typography.sm, fontWeight: Typography.medium, marginBottom: 4 },
  input: {
    borderWidth: 1, borderRadius: Radius.md, padding: Spacing.sm,
    fontSize: Typography.md,
  },
  hint: { textAlign: 'center', fontSize: Typography.xs },

  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderRadius: Radius.lg, borderWidth: 1,
    ...Shadow.sm,
  },
  orderBadge: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginRight: Spacing.sm,
  },
  orderText: { color: '#fff', fontWeight: Typography.bold, fontSize: Typography.sm },
  thumb: { width: 44, height: 60, borderRadius: Radius.md, marginRight: Spacing.md },
  thumbFallback: { justifyContent: 'center', alignItems: 'center' },
  thumbLetter: { color: 'rgba(255,255,255,0.7)', fontSize: 20, fontWeight: Typography.bold },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: Typography.sm, fontWeight: Typography.semiBold },
  rowSub: { fontSize: Typography.xs, marginTop: 2 },
  dragHandle: { fontSize: 24, paddingLeft: Spacing.sm },

  bottomBar: {
    paddingHorizontal: Spacing.base, paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  mergeBtn: {
    height: 52, borderRadius: Radius.xl,
    justifyContent: 'center', alignItems: 'center',
    ...Shadow.md,
  },
  mergeBtnText: { color: '#fff', fontSize: Typography.md, fontWeight: Typography.bold },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', paddingHorizontal: 32,
  },
  modalCard: {
    borderRadius: Radius.xl, padding: Spacing.base,
    maxHeight: 400,
  },
  modalTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, marginBottom: Spacing.md, textAlign: 'center' },
  coverOption: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, borderBottomWidth: 1, gap: Spacing.md,
  },
  coverThumb: { width: 48, height: 64, borderRadius: Radius.md },
  coverLabel: { flex: 1, fontSize: Typography.sm, fontWeight: Typography.medium },
  cancelBtn: {
    marginTop: Spacing.md, paddingVertical: Spacing.md,
    borderRadius: Radius.lg, borderWidth: 1,
    alignItems: 'center',
  },
});
