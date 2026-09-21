import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import { unzipSync, strFromU8, zipSync, strToU8 } from 'fflate';
import { decodeBase64, encodeBase64 } from '../utils/base64';

export const EPUB_STORAGE_DIR = FileSystem.documentDirectory + 'epubs/';

export interface EpubChapter {
  id: string;
  href: string;        // OPF'e göre göreli yol (örn: OEBPS/Text/ch1.xhtml)
  fullPath: string;    // Cihazdaki tam dosya yolu
  chapterBaseDir: string; // WebView base URL için — dosyanın bulunduğu klasör
  title: string;
}

export interface EpubParseResult {
  firstPageHtml: string | null;
  baseDir: string;
  firstPagePath: string | null;
  chapters: EpubChapter[];
  coverImagePath: string | null;
}

/**
 * Verilen bir epub dosyasını unzip eder ve cihaz hafızasındaki kalıcı klasörüne yazar.
 * OPF haritasını çıkararak bölümlerin rotasını oluşturur.
 */
export const loadEpubAndExtract = async (fileUri: string, bookId: string): Promise<EpubParseResult> => {
  // expo-file-system/legacy'nin copyAsync/readAsStringAsync'i, DocumentPicker'ın
  // SAF cache'ine yazdığı dosyayı Android'de tutarlı biçimde "isn't readable"
  // hatasıyla reddediyor (legacy shim'in content-resolver URI'leriyle bilinen
  // uyumsuzluğu — bkz. expo/expo#21792). Yeni (non-legacy) File API bu URI'leri
  // doğru çözüyor; ara kopyalama adımına gerek kalmadan doğrudan okuyoruz.
  const arrayBuffer = await new File(fileUri).arrayBuffer();
  const uint8Data = new Uint8Array(arrayBuffer);
  const unzipped = unzipSync(uint8Data);

  const bookDir = EPUB_STORAGE_DIR + bookId + '/';

  // Eski dizini temizle ve yenisini oluştur
  await FileSystem.deleteAsync(bookDir, { idempotent: true }).catch(() => {});
  await FileSystem.makeDirectoryAsync(bookDir, { intermediates: true });

  const fileContentsStr: Record<string, string> = {};
  
  for (const [filename, u8] of Object.entries(unzipped)) {
    if (filename.endsWith('/')) continue;
    
    const parts = filename.split('/');
    if (parts.length > 1) {
      const dir = parts.slice(0, -1).join('/');
      await FileSystem.makeDirectoryAsync(bookDir + dir, { intermediates: true }).catch(() => {});
    }

    const destPath = bookDir + filename;
    const base64Str = encodeBase64(u8);
    await FileSystem.writeAsStringAsync(destPath, base64Str, { encoding: 'base64' });

    if (filename.endsWith('.opf') || filename.endsWith('.xml') ||
        filename.endsWith('.xhtml') || filename.endsWith('.html') ||
        filename.endsWith('.ncx')) {
       fileContentsStr[filename] = strFromU8(u8);
    }
  }

  // --- EPUB BÖLÜM AYRIŞTIRICI ---
  const chapters: EpubChapter[] = [];
  let coverImagePath: string | null = null;
  try {
    // 1. OPF yolunu bul
    let opfPath = 'OEBPS/content.opf';
    const containerXml = fileContentsStr['META-INF/container.xml'];
    if (containerXml) {
       const opfMatch = containerXml.match(/full-path="([^"]+)"/i);
       if (opfMatch) opfPath = opfMatch[1];
    }
    
    const opfContent = fileContentsStr[opfPath];
    if (opfContent) {
       const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

       // 2. Manifest: tüm id → href ve properties eşlemesi
       const manifestMap: Record<string, string> = {};
       const manifestRegex = /<item\s([^>]*)>/gi;
       let m;
       while ((m = manifestRegex.exec(opfContent)) !== null) {
         const attrs    = m[1];
         const idMatch   = attrs.match(/id="([^"]+)"/);
         const hrefMatch = attrs.match(/href="([^"]+)"/);
         const propMatch = attrs.match(/properties="([^"]+)"/);
         const mediaType = attrs.match(/media-type="([^"]+)"/);
         if (idMatch && hrefMatch) {
           const itemId   = idMatch[1];
           const itemHref = hrefMatch[1];
           manifestMap[itemId] = itemHref;

           // Kapak görseli tespiti
           if (!coverImagePath) {
             const isCoverProp = propMatch && propMatch[1].includes('cover-image');
             const isCoverId   = /cover/i.test(itemId);
             const isImage     = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(itemHref) ||
                                 (mediaType?.[1] || '').startsWith('image/');
             if ((isCoverProp || isCoverId) && isImage) {
               coverImagePath = bookDir + opfDir + itemHref;
             }
           }
         }
       }

       // 3. NCX başlık haritasını çıkar (navPoint src → başlık)
       const ncxTitleMap: Record<string, string> = {};
       // NCX dosyasını manifest'ten bul
       const ncxId = Object.keys(manifestMap).find(k =>
         manifestMap[k].endsWith('.ncx') || k.toLowerCase().includes('ncx')
       );
       const ncxPath = ncxId ? opfDir + manifestMap[ncxId] : null;
       const ncxContent = ncxPath ? (fileContentsStr[ncxPath] || fileContentsStr[manifestMap[ncxId!] || '']) : null;

       if (ncxContent) {
         // <navPoint>...<text>Başlık</text>...<content src="..."/>
         const navRegex = /<navPoint[^>]*>[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<content\s[^>]*src="([^"#]+)/gi;
         let np;
         while ((np = navRegex.exec(ncxContent)) !== null) {
           const rawTitle = np[1].replace(/<[^>]+>/g, '').trim();
           const src      = np[2].trim();
           // Hem kısa hem de tam yol ile eşleştirmeye çalış
           ncxTitleMap[src]            = rawTitle;
           ncxTitleMap[opfDir + src]   = rawTitle;
         }
       }

       // 4. Spine sırasına göre chapter'ları oluştur
       const spineRegex = /<itemref\s+[^>]*idref="([^"]+)"/gi;
       let s;
       while ((s = spineRegex.exec(opfContent)) !== null) {
          const id   = s[1];
          const href = manifestMap[id];
          if (href) {
             const fullHref = opfDir + href;
             if (fullHref.endsWith('.html') || fullHref.endsWith('.htm') || fullHref.endsWith('.xhtml')) {
               // Bölüm klasörü (WebView base URL için)
               const chapterBaseDir = bookDir + (
                 fullHref.includes('/')
                   ? fullHref.substring(0, fullHref.lastIndexOf('/') + 1)
                   : ''
               );

               // Başlığı NCX'ten bul, yoksa fallback
               const title =
                 ncxTitleMap[href] ||
                 ncxTitleMap[fullHref] ||
                 ncxTitleMap[href.split('/').pop() || ''] ||
                 `Bölüm ${chapters.length + 1}`;

               chapters.push({
                 id,
                 href: fullHref,
                 fullPath: bookDir + fullHref,
                 chapterBaseDir,
                 title,
               });
             }
          }
       }
    }
  } catch (e) {
    console.error("EPUB ayrıştırma hatası:", e);
  }


  let firstPageHtml = null;
  let firstPagePath = null;
  
  if (chapters.length > 0) {
     firstPagePath = chapters[0].fullPath;
     firstPageHtml = fileContentsStr[chapters[0].href] || null;
  } else {
     // Fallback if regex fails
     const fallbackHtml = Object.keys(fileContentsStr).find(k => k.endsWith('html') || k.endsWith('xhtml'));
     if (fallbackHtml) {
        firstPageHtml = fileContentsStr[fallbackHtml];
        firstPagePath = bookDir + fallbackHtml;
        const fallbackBaseDir = bookDir + (
          fallbackHtml.includes('/')
            ? fallbackHtml.substring(0, fallbackHtml.lastIndexOf('/') + 1)
            : ''
        );
        chapters.push({
          id: 'fallback',
          href: fallbackHtml,
          fullPath: bookDir + fallbackHtml,
          chapterBaseDir: fallbackBaseDir,
          title: 'Bölüm 1',
        });
     }
  }

  return {
    firstPageHtml,
    baseDir: bookDir,
    firstPagePath,
    chapters,
    coverImagePath,
  };
};

/**
 * Değiştirilmiş epub klasörünü tekrar sıkıştırıp yeni bir .epub dosyası oluşturur.
 * EPUB standardı gereği 'mimetype' dosyası sıkıştırılmadan (.level = 0) eklenir.
 */
export const repackageEpub = async (
  tempFolderPath: string, 
  outputPath: string, 
  firstPagePath?: string, 
  newHtmlContent?: string
): Promise<string> => {
  // Eğer güncel metin gönderilmişse önce o dosyayı kaydet
  if (firstPagePath && newHtmlContent) {
    const htmlU8 = strToU8(newHtmlContent);
    const base64Html = encodeBase64(htmlU8);
    await FileSystem.writeAsStringAsync(firstPagePath, base64Html, { encoding: 'base64' });
  }

  const filesToZip: Record<string, any> = {};

  // EPUB standardı gereği 'mimetype' ZIP arşivindeki İLK dosya olmalıdır.
  // JS objelerinde key'ler eklenme sırasına göre iterate edildiği için öncelikle mimetype'ı manuel ekliyoruz.
  try {
    const mimetypeData = await FileSystem.readAsStringAsync(`${tempFolderPath}mimetype`, { encoding: 'base64' });
    filesToZip['mimetype'] = [decodeBase64(mimetypeData), { level: 0 }];
  } catch (e) {
    console.warn("mimetype dosyası root dizinde bulunamadı!");
  }

  // Klasördeki her şeyi recursive tarama fonksiyonu
  const readDirRecursive = async (currentDir: string, relativePath: string) => {
    const items = await FileSystem.readDirectoryAsync(currentDir);
    
    for (const item of items) {
      const fullPath = `${currentDir}${item}`;
      const relPath = relativePath ? `${relativePath}/${item}` : item;
      const info = await FileSystem.getInfoAsync(fullPath);
      
      if (info.isDirectory) {
        await readDirRecursive(fullPath + '/', relPath);
      } else {
        // mimetype'i zaten manuel ekledik, tekrar eklemeye gerek yok
        if (relPath !== 'mimetype') {
          const base64Data = await FileSystem.readAsStringAsync(fullPath, { encoding: 'base64' });
          filesToZip[relPath] = decodeBase64(base64Data);
        }
      }
    }
  };

  // Okuma işlemi başlatılıyor
  await readDirRecursive(tempFolderPath, '');

  // Tüm dosyaları ZIP'e sıkıştır
  // fflate, nesne key'lerini iteration sırası ile yazar, böylece mimetype 1. sırada olur.
  const zippedData = zipSync(filesToZip);
  const finalBase64 = encodeBase64(zippedData);

  // Oluşturulan ZIP'i yeni yol ile kaydet
  await FileSystem.writeAsStringAsync(outputPath, finalBase64, { encoding: 'base64' });

  return outputPath;
};
