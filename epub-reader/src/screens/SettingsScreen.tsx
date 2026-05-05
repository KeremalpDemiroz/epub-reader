import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { Spacing, Typography, PALETTES, AppTheme } from '../theme';
import { useThemeStore } from '../store/useThemeStore';

export default function SettingsScreen() {
  const { 
    theme, paletteId, isDarkMode, setPalette, toggleDarkMode,
    enableHaptics, setEnableHaptics,
    showClockAndBattery, setShowClockAndBattery,
    enableReadingTracking, setEnableReadingTracking,
    enableVolumeNavigation, setEnableVolumeNavigation,
    scrollBuffer, setScrollBuffer
  } = useThemeStore();
  const styles = getStyles(theme);

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 200 }}
    >
      
      <View style={styles.section}>
        <Text style={styles.title}>Uygulama Teması</Text>
        <View style={styles.row}>
          {PALETTES.map(p => (
            <TouchableOpacity 
              key={p.id}
              style={[styles.circle, { backgroundColor: p.color, borderWidth: paletteId === p.id ? 3 : 0 }]}
              onPress={() => setPalette(p.id)}
            />
          ))}
        </View>
        <Text style={styles.subtitle}>Tema seçiminiz anında tüm uygulamaya yansır.</Text>
      </View>

      <View style={[styles.section, styles.switchRow]}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Karanlık Mod (Gece Modu)</Text>
          <Text style={styles.subtitle}>Göz yormayan, seçtiğiniz renge özel siyah tasarımı açın.</Text>
        </View>
        <Switch 
          value={isDarkMode} 
          onValueChange={toggleDarkMode}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={isDarkMode ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      <View style={[styles.section, styles.switchRow]}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Dokunmatik Geri Bildirim (Haptics)</Text>
          <Text style={styles.subtitle}>Butonlara basıldığında ve işlemlerde hafif titreşim hissi verir.</Text>
        </View>
        <Switch 
          value={enableHaptics} 
          onValueChange={setEnableHaptics}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={enableHaptics ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      <View style={[styles.section, styles.switchRow]}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Tam Ekranda Saat ve Pil</Text>
          <Text style={styles.subtitle}>Kitap okurken ekranın köşesinde silik bir şekilde saat ve pil durumunu gösterir.</Text>
        </View>
        <Switch 
          value={showClockAndBattery} 
          onValueChange={setShowClockAndBattery}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={showClockAndBattery ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      <View style={[styles.section, styles.switchRow]}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Okuma Süresi Takibi</Text>
          <Text style={styles.subtitle}>Arka planda hangi kitabı ne kadar okuduğunuzu hesaplar.</Text>
        </View>
        <Switch 
          value={enableReadingTracking} 
          onValueChange={setEnableReadingTracking}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={enableReadingTracking ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      <View style={[styles.section, styles.switchRow]}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Ses Tuşları ile Sayfa Çevir</Text>
          <Text style={styles.subtitle}>Cihazın ses artırma/azaltma tuşlarını kullanarak sayfalar arası geçiş yapın.</Text>
        </View>
        <Switch 
          value={enableVolumeNavigation} 
          onValueChange={setEnableVolumeNavigation}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={enableVolumeNavigation ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Bölüm Sonu Boşluğu (Kaydırma Modu)</Text>
          <Text style={styles.subtitle}>Bölüm sonuna ulaştığınızda yanlışlıkla diğer bölüme geçmemek için bırakılacak kaydırma boşluğu.</Text>
        </View>
        <View style={[styles.row, { marginTop: Spacing.md, flexWrap: 'wrap' }]}>
          {[
            { label: 'Yok', value: 0 },
            { label: 'Çeyrek', value: 25 },
            { label: 'Yarım', value: 50 },
            { label: 'Tam', value: 100 }
          ].map(opt => (
            <TouchableOpacity 
              key={opt.value}
              style={[
                styles.optionBtn, 
                scrollBuffer === opt.value && { backgroundColor: theme.primary, borderColor: theme.primary }
              ]}
              onPress={() => setScrollBuffer(opt.value)}
            >
              <Text style={[
                styles.optionBtnText, 
                scrollBuffer === opt.value && { color: '#fff' }
              ]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

    </ScrollView>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: { flex: 1, padding: Spacing.xl, backgroundColor: theme.background },
  section: { marginBottom: Spacing.xxl },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  textContainer: { flex: 1, paddingRight: Spacing.md },
  title: { fontSize: Typography.lg, fontWeight: Typography.bold, color: theme.textPrimary, marginBottom: Spacing.xs },
  row: { flexDirection: 'row', gap: Spacing.md },
  circle: { width: 44, height: 44, borderRadius: 22, borderColor: theme.textPrimary, elevation: 2 },
  subtitle: { fontSize: Typography.sm, color: theme.textMuted, marginTop: 4, maxWidth: '100%' },
  optionBtn: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  optionBtnText: {
    fontSize: Typography.sm, fontWeight: Typography.medium, color: theme.textSecondary,
  }
});
