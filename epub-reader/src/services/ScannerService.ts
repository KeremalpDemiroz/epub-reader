import * as FileSystem from 'expo-file-system/legacy';

const EXCLUDED_DIRS = [
  'data', 'obb', 'lost+found', '.sys', '.Trashes',
  'WhatsApp', 'Telegram', 'Instagram', 'DCIM', 'Camera',
  'Screenshots', 'Ringtones', 'Alarms', 'Notifications', 'Podcasts',
];

export async function scanDeviceForEpubs(
  rootPath: string = 'file:///storage/emulated/0',
  onProgress?: (dir: string) => void
): Promise<{ uri: string; name: string }[]> {
  // file:// prefix yoksa ekle
  const dirUri = rootPath.startsWith('file://') ? rootPath : `file://${rootPath}`;
  let found: { uri: string; name: string }[] = [];
  
  try {
    const dirName = dirUri.split('/').pop() || '';
    if (onProgress) onProgress(dirName);
    
    const entries = await FileSystem.readDirectoryAsync(dirUri);
    
    for (const entry of entries) {
      if (EXCLUDED_DIRS.includes(entry) || entry.startsWith('.')) continue;

      const fullPath = `${dirUri}/${entry}`;
      
      if (entry.toLowerCase().endsWith('.epub')) {
        found.push({ uri: fullPath, name: entry });
      } else { 
        try {
          const entryInfo = await FileSystem.getInfoAsync(fullPath);
          if (entryInfo.isDirectory) {
            const subFound = await scanDeviceForEpubs(fullPath, onProgress);
            found = found.concat(subFound);
          }
        } catch (e) {
          // Okunamayan klasörleri atla
        }
      }
    }
  } catch (e: any) {
    console.warn("Okunamayan dizin:", dirUri, e?.message || e);
  }
  
  console.log(`[Scanner] ${dirUri} → ${found.length} epub bulundu`);
  return found;
}

export async function scanDeviceForEpubsSAF(
  dirUri: string,
  onProgress?: (dir: string) => void
): Promise<{ uri: string; name: string }[]> {
  let found: { uri: string; name: string }[] = [];
  try {
    if (onProgress) onProgress('Klasör taranıyor...');
    const entries = await FileSystem.StorageAccessFramework.readDirectoryAsync(dirUri);
    
    for (const uri of entries) {
      const decodedUri = decodeURIComponent(uri);
      
      if (decodedUri.toLowerCase().endsWith('.epub')) {
        let name = decodedUri.split('/').pop() || 'kitap.epub';
        if (name.includes(':')) {
           name = name.split(':').pop() || name;
        }
        found.push({ uri, name });
      } else if (!decodedUri.includes('.')) {
        try {
          const subFound = await scanDeviceForEpubsSAF(uri, onProgress);
          found = found.concat(subFound);
        } catch (e) {
          // Klasör değilse atla
        }
      }
    }
  } catch (e) {
    console.warn("SAF Okunamayan dizin:", dirUri);
  }
  return found;
}
