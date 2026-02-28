import { useEffect, useCallback } from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  SlideInUp,
  SlideOutUp,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ILOWA_COLORS } from '../theme/colors';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss: () => void;
}

const TOAST_CONFIG: Record<ToastType, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  success: { icon: 'checkmark-circle', color: ILOWA_COLORS.truth, bg: 'rgba(16, 185, 129, 0.15)' },
  error: { icon: 'close-circle', color: ILOWA_COLORS.doubt, bg: 'rgba(239, 68, 68, 0.15)' },
  info: { icon: 'information-circle', color: ILOWA_COLORS.cyan, bg: 'rgba(0, 217, 255, 0.15)' },
  warning: { icon: 'warning', color: ILOWA_COLORS.gold, bg: 'rgba(255, 215, 0, 0.15)' },
};

export function Toast({ visible, message, type = 'info', duration = 3000, onDismiss }: ToastProps) {
  const insets = useSafeAreaInsets();
  const config = TOAST_CONFIG[type];

  useEffect(() => {
    if (visible) {
      // Haptic feedback based on type
      if (type === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === 'error') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onDismiss, type]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(15)}
      exiting={SlideOutUp.duration(200)}
      style={[
        styles.container,
        { top: insets.top + 10, backgroundColor: config.bg },
      ]}
    >
      <Pressable style={styles.content} onPress={onDismiss}>
        <Ionicons name={config.icon} size={22} color={config.color} />
        <Text style={[styles.message, { color: config.color }]}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}

import { createContext, useContext, useState, ReactNode } from 'react';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toastState, setToastState] = useState<{
    visible: boolean;
    message: string;
    type: ToastType;
    duration: number;
  }>({
    visible: false,
    message: '',
    type: 'info',
    duration: 3000,
  });

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    setToastState({ visible: true, message, type, duration });
  }, []);

  const handleDismiss = useCallback(() => {
    setToastState(prev => ({ ...prev, visible: false }));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast
        visible={toastState.visible}
        message={toastState.message}
        type={toastState.type}
        duration={toastState.duration}
        onDismiss={handleDismiss}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      showToast: (message: string, type?: ToastType) => {
        console.log(`[Toast] ${type}: ${message}`);
      },
    };
  }
  return context;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 16,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  message: {
    flex: 1,
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    lineHeight: 20,
  },
});
