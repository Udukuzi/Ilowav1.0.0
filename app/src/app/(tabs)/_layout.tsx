import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ILOWA_COLORS } from '../../theme/colors';
import { ILOWA_TYPOGRAPHY } from '../../theme/typography';
import { Ionicons } from '@expo/vector-icons';

type TabIconName = 'home' | 'radio' | 'storefront' | 'sparkles' | 'person';
type TabIconOutline = 'home-outline' | 'radio-outline' | 'storefront-outline' | 'sparkles-outline' | 'person-outline';

interface TabIconConfig {
  active: TabIconName;
  inactive: TabIconOutline;
  color: string;
}

const TAB_ICONS: Record<string, TabIconConfig> = {
  home: { active: 'home', inactive: 'home-outline', color: ILOWA_COLORS.gold },
  radio: { active: 'radio', inactive: 'radio-outline', color: ILOWA_COLORS.cyan },
  markets: { active: 'storefront', inactive: 'storefront-outline', color: ILOWA_COLORS.gold },
  ai: { active: 'sparkles', inactive: 'sparkles-outline', color: ILOWA_COLORS.purple },
  profile: { active: 'person', inactive: 'person-outline', color: ILOWA_COLORS.cyan },
};

function TabBarIcon({ name, focused }: { name: string; focused: boolean }) {
  const config = TAB_ICONS[name];
  if (!config) return null;

  return (
    <View style={styles.iconContainer}>
      {focused && (
        <View
          style={[
            styles.activeGlow,
            { backgroundColor: config.color, shadowColor: config.color },
          ]}
        />
      )}
      <Ionicons
        name={focused ? config.active : config.inactive}
        size={24}
        color={focused ? config.color : ILOWA_COLORS.textMuted}
      />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: ILOWA_COLORS.deepBlack,
          borderTopColor: 'rgba(255, 255, 255, 0.08)',
          borderTopWidth: 1,
          height: 70 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarActiveTintColor: ILOWA_COLORS.gold,
        tabBarInactiveTintColor: ILOWA_COLORS.textMuted,
        tabBarLabelStyle: {
          fontFamily: 'Sora',
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.5,
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabBarIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="radio"
        options={{
          title: 'Radio',
          tabBarIcon: ({ focused }) => <TabBarIcon name="radio" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="markets"
        options={{
          title: 'Markets',
          tabBarIcon: ({ focused }) => <TabBarIcon name="markets" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI',
          tabBarIcon: ({ focused }) => <TabBarIcon name="ai" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabBarIcon name="profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 32,
  },
  activeGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.15,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
});
