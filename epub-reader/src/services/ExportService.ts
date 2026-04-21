import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { strFromU8, strToU8 } from 'fflate';
import { decodeBase64, encodeBase64 } from '../utils/base64';
import { repackageEpub } from './EpubManager';
import { useLibraryStore } from '../store/useLibraryStore';
import { useTimelineStore } from '../store/useTimelineStore';
import { applyPatch } from './TimelineService';

export const exportBookWithLatestVersions = async (bookId: string): Promise<boolean> => {
  const book = useLibraryStore.getState().getBook(bookId);
  if (!book || !book.chapters) return false;

  const versionsByNode = useTimelineStore.getState().versionsByNode;

  // Tüm bölümleri dolaş ve kayıtlı patch'leri orijinal dosyalara uygula
  for (const chapter of book.chapters) {
    const nodeKey = `${bookId}_${chapter.id}`;
    const versions = versionsByNode[nodeKey] || [];

    if (versions.length > 0) {
      try {
        // 1. Orijinal dosyayı oku
        const base64Data = await FileSystem.readAsStringAsync(chapter.fullPath, { encoding: 'base64' });
        const uint8Data = decodeBase64(base64Data);
        let currentHtml = strFromU8(uint8Data);

        // 2. Patch'leri sırayla uygula
        for (const version of versions) {
          currentHtml = applyPatch(currentHtml, version.patch);
        }

        // 3. Güncel HTML'yi tekrar Base64 olarak dosyaya yaz
        const newHtmlU8 = strToU8(currentHtml);
        const newBase64 = encodeBase64(newHtmlU8);
        await FileSystem.writeAsStringAsync(chapter.fullPath, newBase64, { encoding: 'base64' });
      } catch (e) {
        console.error(`Bölüm güncellenirken hata: ${chapter.id}`, e);
      }
    }
  }

  // 4. Güncellenmiş klasörü yeniden paketle (.epub oluştur)
  // Paylaşıma uygun olması için cacheDirectory kullanıyoruz
  const exportPath = `${FileSystem.cacheDirectory}export_${book.filename.replace(/\s+/g, '_')}`;
  
  try {
    // Eski dosya kalıntısı varsa temizle
    await FileSystem.deleteAsync(exportPath, { idempotent: true });

    await repackageEpub(book.baseDir, exportPath);
    
    // 5. SAF ile kullanıcıdan dizin seçmesini iste ve kaydet
    const SAF = FileSystem.StorageAccessFramework;
    const permissions = await SAF.requestDirectoryPermissionsAsync();
    
    if (permissions.granted) {
      const newFileUri = await SAF.createFileAsync(permissions.directoryUri, book.filename, 'application/epub+zip');
      const base64Data = await FileSystem.readAsStringAsync(exportPath, { encoding: 'base64' });
      await SAF.writeAsStringAsync(newFileUri, base64Data, { encoding: 'base64' });
      return true;
    } else {
      // Eğer dizin seçimi iptal edildiyse eski paylaşım yöntemini (fallback) dene
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(exportPath, {
          mimeType: 'application/epub+zip',
          dialogTitle: `${book.title} Kitabını Dışa Aktar`,
          UTI: 'org.idpf.epub-container'
        });
        return true;
      }
    }
  } catch (e) {
    console.error("Paketleme ve dışa aktarma hatası", e);
  }

  return false;
};
