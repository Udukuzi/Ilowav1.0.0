import { Easing } from 'react-native-reanimated';

export const ILOWA_ANIMATIONS = {
  elderSelection: {
    duration: 3000,
    easing: Easing.bezier(0.17, 0.67, 0.12, 0.99),
  },

  voiceWave: {
    duration: 1200,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  },

  tabSwitch: {
    duration: 500,
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  },

  shimmer: {
    duration: 600,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  },

  fadeIn: {
    duration: 300,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  },

  springy: {
    damping: 15,
    stiffness: 150,
    mass: 1,
  },
} as const;
