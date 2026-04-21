import * as FileSystem from 'expo-file-system/legacy';

const EXCLUDED_DIRS = ['Android', 'data', 'obb', 'lost+found', '.sys', '.Trashes'];

export async function scanDeviceForEpubs(
  dirUri: string = 'file:///storage/emulated/0',
  onProgress?: (dir: string) => void
): Promise<{ uri: string; name: string }[]> {
  let found: { uri: string; name: string }[] = [];
  
  try {
    if (onProgress) onProgress(dirUri.split('/').pop() || 'Tarama');
    
    const entries = await FileSystem.readDirectoryAsync(dirUri);
    
    for (const entry of entries) {
      if (EXCLUDED_DIRS.includes(entry) || entry.startsWith('.')) continue;

      const fullPath = `${dirUri}/${entry}`;
      
      // Optimizasyon: .epub ise direkt listeye ekle, klasör kontrolüne gerek kalmaz
      if (entry.toLowerCase().endsWith('.epub')) {
        found.push({ uri: fullPath, name: entry });
      } else if (!entry.includes('.')) { 
        // Basit optimizasyon: Uzantısı olmayanlar genelde klasördür (kesin değil ama hızlandırır)
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
  } catch (e) {
    console.warn("Okunamayan dizin:", dirUri);
  }
  
  return found;
}
