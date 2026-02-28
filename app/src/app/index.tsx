import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useRegion } from '../hooks/useRegion';

export default function EntryGate() {
  const router = useRouter();
  const { loading, isRegionSet } = useRegion();

  useEffect(() => {
    if (loading) return;

    const timer = setTimeout(() => {
      if (isRegionSet) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/(onboarding)/wallet');
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [loading, isRegionSet]);

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>ILOWA</Text>
      <Text style={styles.tagline}>The Voice of the Global South</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 52,
    color: '#D4AF37',
    letterSpacing: 10,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#888',
    letterSpacing: 2,
  },
});
