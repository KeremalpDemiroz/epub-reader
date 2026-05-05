import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Animated } from 'react-native';
import { useThemeStore } from '../store/useThemeStore';
import { Typography, Spacing, Radius, Shadow } from '../theme';
import * as Haptics from 'expo-haptics';

export interface AlertButton {
  text: string;
  style?: 'cancel' | 'destructive' | 'default';
  onPress?: () => void;
}

export interface DockAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  onClose: () => void;
}

export function DockAlert({ visible, title, message, buttons = [], onClose }: DockAlertProps) {
  const { theme, enableHaptics } = useThemeStore();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      if (enableHaptics) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Modalı gereksiz yere render etmemek için animasyon durumunu da kontrol edebiliriz
  // Ancak kapanış animasyonu için renderda kalmalı
  if (!visible && (fadeAnim as any)._value === 0) return null;

  const defaultButtons = buttons.length > 0 ? buttons : [{ text: 'Tamam', onPress: () => {} }];

  return (
    <Modal visible={visible || (fadeAnim as any)._value > 0} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.dockCard, { backgroundColor: theme.surface, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.content}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
            {!!message && <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>}
          </View>
          <View style={styles.buttonRow}>
            {defaultButtons.map((btn, idx) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              const textColor = isDestructive ? '#EF4444' : (isCancel ? theme.textSecondary : theme.primary);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.button,
                    idx > 0 && { borderLeftWidth: 1, borderColor: theme.border }
                  ]}
                  onPress={() => {
                    if (enableHaptics) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    onClose();
                    if (btn.onPress) setTimeout(btn.onPress, 200); // animasyonun bitmesini bekle
                  }}
                >
                  <Text style={[styles.buttonText, { color: textColor, fontWeight: isCancel ? Typography.medium : Typography.bold }]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// Hook
export function useDockAlert() {
  const [alertConfig, setAlertConfig] = useState<Omit<DockAlertProps, 'visible' | 'onClose'> | null>(null);
  const [visible, setVisible] = useState(false);

  const showAlert = (title: string, message?: string, buttons?: AlertButton[]) => {
    setAlertConfig({ title, message, buttons });
    setVisible(true);
  };

  const hideAlert = () => {
    setVisible(false);
  };

  const alertElement = (
    <DockAlert
      visible={visible}
      title={alertConfig?.title || ''}
      message={alertConfig?.message}
      buttons={alertConfig?.buttons}
      onClose={hideAlert}
    />
  );

  return { showAlert, hideAlert, alertElement };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  dockCard: {
    margin: Spacing.base,
    marginBottom: Spacing.xl,
    borderRadius: Radius.xl,
    ...Shadow.lg,
    overflow: 'hidden',
  },
  content: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: Typography.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.2)',
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: Typography.md,
  },
});
