import * as FileSystem from 'expo-file-system/legacy';
import { strFromU8, strToU8, zip } from 'fflate';
import { decodeBase64, encodeBase64 } from '../utils/base64';
import { useLibraryStore, Book } from '../store/useLibraryStore';

const MERGE_TEMP = FileSystem.cacheDirectory + 'merge_temp/';

/**
 * Birden fazla kitabı tek bir EPUB dosyasına birleştirir.
 * Kullanıcının belirlediği sıraya göre bölümler art arda eklenir.
 */
export const mergeBooks = async (
  bookIds: string[],
  coverBookId?: string,
  customTitle?: string,
  onProgress?: (msg: string, value?: number) => void
): Promise<string | null> => {
  const getBook = useLibraryStore.getState().getBook;
  const books = bookIds.map(id => getBook(id)).filter(Boolean) as Book[];
  if (books.length < 2) return null;

  // Temizle ve yeniden oluştur
  onProgress?.('Hazırlanıyor...', 0);
  await FileSystem.deleteAsync(MERGE_TEMP, { idempotent: true });
  await FileSystem.makeDirectoryAsync(MERGE_TEMP, { intermediates: true });
  await FileSystem.makeDirectoryAsync(MERGE_TEMP + 'META-INF/', { intermediates: true });
  await FileSystem.makeDirectoryAsync(MERGE_TEMP + 'OEBPS/Text/', { intermediates: true });
  await FileSystem.makeDirectoryAsync(MERGE_TEMP + 'OEBPS/Images/', { intermediates: true });
  await FileSystem.makeDirectoryAsync(MERGE_TEMP + 'OEBPS/Styles/', { intermediates: true });

  // mimetype
  await FileSystem.writeAsStringAsync(
    MERGE_TEMP + 'mimetype',
    'application/epub+zip'
  );

  // container.xml
  await FileSystem.writeAsStringAsync(
    MERGE_TEMP + 'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  // Bölüm ve kaynak toplama
  const manifestItems: string[] = [];
  const spineItems: string[] = [];
  const navPoints: string[] = [];
  const totalChapters = books.reduce((acc, book) => acc + (book.chapters?.length || 0), 0);
  let globalChapterCounter = 0;
  let chapterCounter = 0;
  let imageCounter = 0;
  let coverImageFile: string | null = null;

  // Kapak görselini kopyala
  if (coverBookId) {
    const coverBook = books.find(b => b.id === coverBookId);
    if (coverBook?.coverImagePath) {
      try {
        const info = await FileSystem.getInfoAsync(coverBook.coverImagePath);
        if (info.exists) {
          const ext = coverBook.coverImagePath.split('.').pop()?.toLowerCase() || 'jpg';
          coverImageFile = `cover.${ext}`;
          const b64 = await FileSystem.readAsStringAsync(coverBook.coverImagePath, { encoding: 'base64' });
          await FileSystem.writeAsStringAsync(MERGE_TEMP + 'OEBPS/Images/' + coverImageFile, b64, { encoding: 'base64' });
          
          const mimeType = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg';
          manifestItems.push(`    <item id="cover-image" href="Images/${coverImageFile}" media-type="${mimeType}" properties="cover-image"/>`);
        }
      } catch {}
    }
  }

  for (let bookIdx = 0; bookIdx < books.length; bookIdx++) {
    const book = books[bookIdx];
    if (!book.chapters) continue;
    
    onProgress?.(`İşleniyor: ${book.title}`, (globalChapterCounter / Math.max(1, totalChapters)) * 90); // Yüzde 90'a kadar okuma işlemi

    // Kitabın kaynak dizinlerini tara — görseller ve CSS'leri kopyala
    const resourceMap: Record<string, string> = {}; // orijinal göreli yol → yeni yol

    for (const chapter of book.chapters) {
      chapterCounter++;
      globalChapterCounter++;
      
      if (globalChapterCounter % 2 === 0) {
        await new Promise(r => setTimeout(r, 10)); // UI Thread'e nefes aldır
      }
      
      onProgress?.(`Bölüm İşleniyor: ${globalChapterCounter}/${totalChapters}`, (globalChapterCounter / Math.max(1, totalChapters)) * 90);

      const chId = `ch_${bookIdx}_${chapterCounter}`;
      const newFileName = `${chId}.xhtml`;

      // Orijinal XHTML'yi oku
      let htmlContent = '';
      try {
        const b64 = await FileSystem.readAsStringAsync(chapter.fullPath, { encoding: 'base64' });
        htmlContent = strFromU8(decodeBase64(b64));
      } catch {
        htmlContent = `<html><body><p>İçerik okunamadı</p></body></html>`;
      }

      // İçerikteki görselleri tespit et ve kopyala
      const imgRegex = /(src|href)=["'](.*?\.(jpg|jpeg|png|gif|svg|webp))["']/gi;
      let match;
      while ((match = imgRegex.exec(htmlContent)) !== null) {
        const relPath = match[2];
        if (relPath.startsWith('http') || relPath.startsWith('data:')) continue;
        if (resourceMap[`${bookIdx}_${relPath}`]) continue;

        imageCounter++;
        const ext = relPath.split('.').pop()?.toLowerCase() || 'jpg';
        const newImgName = `img_${bookIdx}_${imageCounter}.${ext}`;

        // Orijinal görsel yolunu çöz
        let resolvedPath = chapter.chapterBaseDir + relPath;
        while (resolvedPath.includes('/../')) {
          resolvedPath = resolvedPath.replace(/\/[^/]+\/\.\.\//, '/');
        }

        try {
          const imgB64 = await FileSystem.readAsStringAsync(resolvedPath, { encoding: 'base64' });
          await FileSystem.writeAsStringAsync(MERGE_TEMP + 'OEBPS/Images/' + newImgName, imgB64, { encoding: 'base64' });
          resourceMap[`${bookIdx}_${relPath}`] = newImgName;

          const mimeType = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          manifestItems.push(`    <item id="img_${bookIdx}_${imageCounter}" href="Images/${newImgName}" media-type="${mimeType}"/>`);
        } catch {}
      }

      // HTML içindeki görsel yollarını güncelle
      htmlContent = htmlContent.replace(imgRegex, (_full, attr, relP, _ext) => {
        const key = `${bookIdx}_${relP}`;
        if (resourceMap[key]) {
          return `${attr}="../Images/${resourceMap[key]}"`;
        }
        return _full;
      });

      // CSS referanslarını kaldır (farklı kitaplardan gelen CSS'ler çakışabilir)
      htmlContent = htmlContent.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '');

      // XHTML olarak kaydet
      const htmlU8 = strToU8(htmlContent);
      await FileSystem.writeAsStringAsync(
        MERGE_TEMP + 'OEBPS/Text/' + newFileName,
        encodeBase64(htmlU8),
        { encoding: 'base64' }
      );

      manifestItems.push(`    <item id="${chId}" href="Text/${newFileName}" media-type="application/xhtml+xml"/>`);
      spineItems.push(`    <itemref idref="${chId}"/>`);
      navPoints.push(`    <navPoint id="nav_${chId}" playOrder="${chapterCounter}">
      <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>
      <content src="Text/${newFileName}"/>
    </navPoint>`);
    }
  }

  // NCX
  manifestItems.push(`    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`);

  const mergedTitle = customTitle || books.map(b => b.title).join(' + ');

  // content.opf
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">merged-${Date.now()}</dc:identifier>
    <dc:title>${escapeXml(mergedTitle)}</dc:title>
    <dc:language>tr</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
${manifestItems.join('\n')}
  </manifest>
  <spine toc="ncx">
${spineItems.join('\n')}
  </spine>
</package>`;

  await FileSystem.writeAsStringAsync(MERGE_TEMP + 'OEBPS/content.opf', opf);

  // toc.ncx
  const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="merged-${Date.now()}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(mergedTitle)}</text></docTitle>
  <navMap>
${navPoints.join('\n')}
  </navMap>
</ncx>`;

  await FileSystem.writeAsStringAsync(MERGE_TEMP + 'OEBPS/toc.ncx', ncx);

  // ZIP oluştur (mimetype sıkıştırmasız)
  onProgress?.('Paketleniyor...', 95);
  const filesToZip: Record<string, any> = {};

  // mimetype ilk
  filesToZip['mimetype'] = [strToU8('application/epub+zip'), { level: 0 }];

  const readDir = async (dir: string, rel: string) => {
    const items = await FileSystem.readDirectoryAsync(dir);
    for (const item of items) {
      const full = dir + item;
      const relPath = rel ? `${rel}/${item}` : item;
      const info = await FileSystem.getInfoAsync(full);
      if (info.isDirectory) {
        await readDir(full + '/', relPath);
      } else if (relPath !== 'mimetype') {
        const b64 = await FileSystem.readAsStringAsync(full, { encoding: 'base64' });
        filesToZip[relPath] = decodeBase64(b64);
      }
    }
  };

  await readDir(MERGE_TEMP, '');
  
  onProgress?.('Epub Oluşturuluyor...', 98);
  const zipped = await new Promise<Uint8Array>((resolve, reject) => {
    zip(filesToZip, { level: 0 }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  const outputPath = FileSystem.cacheDirectory + `merged_${Date.now()}.epub`;
  await FileSystem.writeAsStringAsync(outputPath, encodeBase64(zipped), { encoding: 'base64' });

  // Temizle
  await FileSystem.deleteAsync(MERGE_TEMP, { idempotent: true });

  return outputPath;
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
