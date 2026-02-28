import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import { ILOWA_COLORS } from '../theme/colors';
import { Elder } from '../types/elder';

interface ElderAvatarProps {
  elder: Elder;
  size: number;
  showGlow?: boolean;
  showName?: boolean;
}

export function ElderAvatar({ elder, size, showGlow = false, showName = false }: ElderAvatarProps) {
  const colors = ILOWA_COLORS.elders[elder.region];
  const initials = elder.name
    .split(' ')
    .map((w) => w[0])
    .join('');

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {showGlow && (
        <View
          style={[
            styles.glow,
            {
              width: size + 12,
              height: size + 12,
              borderRadius: (size + 12) / 2,
              backgroundColor: colors.glow,
              shadowColor: colors.primary,
            },
          ]}
        />
      )}
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: showGlow ? colors.primary : 'rgba(255,255,255,0.15)',
            backgroundColor: ILOWA_COLORS.cardDark,
          },
        ]}
      >
        {elder.avatar ? (
          <Image
            source={typeof elder.avatar === 'number' ? elder.avatar : { uri: elder.avatar as string }}
            style={{ width: size - 8, height: size - 8, borderRadius: (size - 8) / 2 }}
          />
        ) : (
          <Text
            style={[
              styles.initials,
              { fontSize: size * 0.3, color: colors.primary },
            ]}
          >
            {initials}
          </Text>
        )}
      </View>
      {showName && (
        <Text style={[styles.name, { color: colors.primary }]} numberOfLines={1}>
          {elder.name}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    opacity: 0.4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: Platform.OS === 'android' ? 2 : 8,
  },
  avatar: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontFamily: 'Sora-Bold',
    letterSpacing: 1,
  },
  name: {
    fontFamily: 'Sora',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
});
