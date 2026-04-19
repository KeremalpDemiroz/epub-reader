/**
 * ============================================================
 *  THEME.TS — Merkezi Design System
 *  Renk, tipografi veya boşluk değiştirmek için YALNIZCA
 *  bu dosyayı düzenleyin. Tüm screen'ler buradan import eder.
 * ============================================================
 */

// ─── RENKLER ────────────────────────────────────────────────
export interface AppTheme {
  id: string;         // e.g. "mor-mavi-light"
  name: string;       // e.g. "Mor Mavi"
  primary: string;
  primaryLight: string;
  primaryDark: string;
  success: string;
  successLight: string;
  danger: string;
  dangerLight: string;
  warning: string;
  warningLight: string;
  background: string; // Ekran arka planı
  surface: string;    // Kart / Panel arka planı
  border: string;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnDark: string;
}

export const PALETTES = [
  { id: 'mor-mavi', name: 'Mor Mavi', color: '#5B5FEF' },
  { id: 'yesil', name: 'Yeşil', color: '#22C55E' },
  { id: 'kirmizi', name: 'Kırmızı', color: '#EF4444' },
  { id: 'hardal', name: 'Hardal', color: '#F59E0B' },
];

export const generateTheme = (paletteId: string, isDark: boolean): AppTheme => {
  const palette = PALETTES.find(p => p.id === paletteId) || PALETTES[0];
  const primary = palette.color;

  if (isDark) {
    // Koyu yüzeylere seçilen ana rengin çok koyu/hafif bir tonu yayılır.
    // Örnek: bg çok koyu siyah ama hafifçe primary tonuna sahip.
    return {
      id: `${palette.id}-dark`,
      name: palette.name,
      primary: primary,
      primaryLight: '#1E293B', // dark surface blend
      primaryDark: primary, 
      success: '#10B981', successLight: '#064E3B',
      danger: '#EF4444', dangerLight: '#7F1D1D',
      warning: '#F59E0B', warningLight: '#78350F',
      // Ana renge göre çok koyu (tint lenmiş) background:
      background: paletteId === 'mor-mavi' ? '#0A0A14' : paletteId === 'yesil' ? '#0A120A' : paletteId === 'kirmizi' ? '#140A0A' : '#14140A',
      surface: paletteId === 'mor-mavi' ? '#12121E' : paletteId === 'yesil' ? '#121E12' : paletteId === 'kirmizi' ? '#1E1212' : '#1E1E12',
      border: '#374151', divider: '#1F2937',
      textPrimary: '#F9FAFB', textSecondary: '#D1D5DB', textMuted: '#6B7280', textOnDark: '#FFFFFF',
    };
  }

  return {
    id: `${palette.id}-light`,
    name: palette.name,
    primary: primary,
    primaryLight: paletteId === 'mor-mavi' ? '#EEF0FF' : paletteId === 'yesil' ? '#DCFCE7' : paletteId === 'kirmizi' ? '#FEE2E2' : '#FEF3C7',
    primaryDark: primary,
    success: '#22C55E', successLight: '#DCFCE7',
    danger: '#EF4444', dangerLight: '#FEE2E2',
    warning: '#F59E0B', warningLight: '#FEF3C7',
    // Ana renge göre aydınlık ama hafif soğuk tonlu background
    background: paletteId === 'mor-mavi' ? '#F4F5FB' : paletteId === 'yesil' ? '#F4FDF4' : paletteId === 'kirmizi' ? '#FDF4F4' : '#FDFBF4',
    surface: '#FFFFFF',
    border: '#E5E7EB', divider: '#F3F4F6',
    textPrimary: '#111827', textSecondary: '#6B7280', textMuted: '#9CA3AF', textOnDark: '#FFFFFF',
  };
};

// Fallback for static elements that haven't been dynamically linked yet
export const Colors = generateTheme('mor-mavi', false);

// ─── TİPOGRAFİ ──────────────────────────────────────────────
export const Typography = {
  // Font boyutları
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  30,

  // Font ağırlıkları (React Native için string)
  regular:    '400' as const,
  medium:     '500' as const,
  semiBold:   '600' as const,
  bold:       '700' as const,
  extraBold:  '800' as const,
};

// ─── BOŞLUKLAR ──────────────────────────────────────────────
export const Spacing = {
  xxs:  2,
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   24,
  xl:   32,
  xxl:  48,
};

// ─── SINIRLANDIRILMIŞ KÖŞELEr ────────────────────────────────
export const Radius = {
  sm:   6,
  md:   10,
  lg:   16,
  xl:   24,
  full: 999,
};

// ─── GÖLGELER ────────────────────────────────────────────────
export const Shadow = {
  sm: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius:  3,
    elevation:     2,
  },
  md: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius:  8,
    elevation:     4,
  },
  lg: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius:  16,
    elevation:     8,
  },
} as const;
