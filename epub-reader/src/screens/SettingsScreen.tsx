import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Spacing, Typography, PALETTES, AppTheme } from '../theme';
import { useThemeStore } from '../store/useThemeStore';

export default function SettingsScreen() {
  const { theme, paletteId, isDarkMode, setPalette, toggleDarkMode } = useThemeStore();
  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      
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
        <View>
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

    </View>
  );
}

const getStyles = (theme: AppTheme) => StyleSheet.create({
  container: { flex: 1, padding: Spacing.xl, backgroundColor: theme.background },
  section: { marginBottom: Spacing.xxl },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: Typography.lg, fontWeight: Typography.bold, color: theme.textPrimary, marginBottom: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
  circle: { width: 44, height: 44, borderRadius: 22, borderColor: theme.textPrimary, elevation: 2 },
  subtitle: { fontSize: Typography.sm, color: theme.textMuted, marginTop: 6, maxWidth: '80%' }
});
