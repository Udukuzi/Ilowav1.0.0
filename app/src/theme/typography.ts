import { TextStyle } from 'react-native';

export const ILOWA_TYPOGRAPHY = {
  brand: {
    fontFamily: 'Sora',
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: 2,
    textTransform: 'uppercase' as TextStyle['textTransform'],
  },

  elder: {
    fontFamily: 'Sora',
    fontSize: 36,
    fontWeight: '700' as TextStyle['fontWeight'],
    letterSpacing: -1,
  },

  heading: {
    fontFamily: 'Sora',
    fontSize: 24,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: -0.5,
  },

  subheading: {
    fontFamily: 'Sora',
    fontSize: 18,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: 0,
  },

  body: {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 24,
  },

  bodySmall: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 20,
  },

  whisper: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontStyle: 'italic' as TextStyle['fontStyle'],
    opacity: 0.7,
  },

  caption: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 16,
  },

  tabLabel: {
    fontFamily: 'Sora',
    fontSize: 10,
    fontWeight: '600' as TextStyle['fontWeight'],
    letterSpacing: 0.5,
  },
} as const;
