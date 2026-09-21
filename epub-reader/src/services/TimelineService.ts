import { diff_match_patch as DiffMatchPatch } from 'diff-match-patch';

const dmp = new DiffMatchPatch();

/**
 * İki metni karşılaştırır ve aralarındaki farkı (patch) metin formatında döndürür.
 * 
 * @param originalText Orijinal metin
 * @param newText Değiştirilmiş yeni metin
 * @returns Oluşturulan patch metni
 */
export const createPatch = (originalText: string, newText: string): string => {
  const diffs = dmp.diff_main(originalText, newText);
  
  // Daha anlamlı patchler oluşturmak için semantik temizleme yapıyoruz
  dmp.diff_cleanupSemantic(diffs);
  
  const patches = dmp.patch_make(originalText, diffs);
  return dmp.patch_toText(patches);
};

/**
 * Orijinal metin üzerine bir patch metnini uygular ve elde edilen yeni metni döndürür.
 * 
 * @param originalText Orijinal metin
 * @param patchText createPatch ile oluşturulmuş patch metni
 * @returns Patch uygulandıktan sonraki yeni metin
 */
export const applyPatch = (originalText: string, patchText: string): string => {
  const patches = dmp.patch_fromText(patchText);
  const results = dmp.patch_apply(patches, originalText);
  
  // results formatı: [newText, boolean[]]
  // boolean array her bir patch'in durumunu tutar
  const newText = results[0];
  
  return newText;
};
