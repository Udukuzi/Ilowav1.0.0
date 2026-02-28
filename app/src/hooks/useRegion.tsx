import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Elder } from '../types/elder';
import { ElderRegionKey, ILOWA_COLORS } from '../theme/colors';
import { ELDERS, getElderByRegion } from '../data/elders';
import { Language, getLanguagesByRegion, getLanguageByCode } from '../data/languages';

// ── Region → Timezone mapping ──────────────────────────────────────────
const REGION_TIMEZONES: Record<ElderRegionKey, string> = {
  westAfrica: 'Africa/Lagos',
  eastAfrica: 'Africa/Nairobi',
  southernAfrica: 'Africa/Johannesburg',
  latinAmerica: 'America/Bogota',
  southAsia: 'Asia/Kolkata',
  southeastAsia: 'Asia/Manila',
  mena: 'Asia/Riyadh',
  caribbean: 'America/Port-au-Prince',
  pacific: 'Pacific/Auckland',
};

// ── Persisted keys ─────────────────────────────────────────────────────
const STORE_KEY_REGION = 'ilowa_region';
const STORE_KEY_LANGUAGE = 'ilowa_language';

// ── Types ──────────────────────────────────────────────────────────────
export interface RegionConfig {
  region: ElderRegionKey;
  languageCode: string;
}

export interface RegionState {
  /** True while reading from SecureStore on cold start */
  loading: boolean;
  /** Null until region is chosen */
  config: RegionConfig | null;
  /** Derived from config.region — the 1:1 Elder */
  activeElder: Elder;
  /** Derived elder color palette */
  elderColors: { primary: string; secondary: string; glow: string };
  /** Derived language object */
  activeLanguage: Language;
  /** IANA timezone string */
  timezone: string;
  /** Languages available for the active region */
  regionLanguages: Language[];
  /** Set region + language (persists) */
  setRegion: (region: ElderRegionKey, languageCode: string) => Promise<void>;
  /** Change just the language within current region */
  setLanguage: (languageCode: string) => Promise<void>;
  /** Clear region (for re-onboarding / settings switch) */
  clearRegion: () => Promise<void>;
  /** Whether onboarding region selection is complete */
  isRegionSet: boolean;
}

// ── Defaults (used before region is chosen) ────────────────────────────
const DEFAULT_ELDER = ELDERS[0];
const DEFAULT_COLORS = ILOWA_COLORS.elders[DEFAULT_ELDER.region];
const DEFAULT_LANGUAGE: Language = { code: 'en', name: 'English', nativeName: 'English', region: 'global', rtl: false };

// ── Context ────────────────────────────────────────────────────────────
const RegionContext = createContext<RegionState | null>(null);

export function RegionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<RegionConfig | null>(null);

  // Hydrate from SecureStore on mount
  useEffect(() => {
    (async () => {
      try {
        const storedRegion = await SecureStore.getItemAsync(STORE_KEY_REGION);
        const storedLang = await SecureStore.getItemAsync(STORE_KEY_LANGUAGE);
        if (storedRegion) {
          setConfig({
            region: storedRegion as ElderRegionKey,
            languageCode: storedLang || 'en',
          });
        }
      } catch {
        // First launch — no stored region
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setRegion = useCallback(async (region: ElderRegionKey, languageCode: string) => {
    await SecureStore.setItemAsync(STORE_KEY_REGION, region);
    await SecureStore.setItemAsync(STORE_KEY_LANGUAGE, languageCode);
    setConfig({ region, languageCode });
  }, []);

  const setLanguage = useCallback(async (languageCode: string) => {
    if (!config) return;
    await SecureStore.setItemAsync(STORE_KEY_LANGUAGE, languageCode);
    setConfig((prev) => prev ? { ...prev, languageCode } : prev);
  }, [config]);

  const clearRegion = useCallback(async () => {
    await SecureStore.deleteItemAsync(STORE_KEY_REGION);
    await SecureStore.deleteItemAsync(STORE_KEY_LANGUAGE);
    setConfig(null);
  }, []);

  // Derived values
  const activeElder = config ? (getElderByRegion(config.region) ?? DEFAULT_ELDER) : DEFAULT_ELDER;
  const elderColors = config ? ILOWA_COLORS.elders[config.region] : DEFAULT_COLORS;
  const activeLanguage = config
    ? (getLanguageByCode(config.languageCode) ?? DEFAULT_LANGUAGE)
    : DEFAULT_LANGUAGE;
  const timezone = config ? REGION_TIMEZONES[config.region] : 'UTC';
  const regionLanguages = config ? getLanguagesByRegion(config.region) : [];

  const value: RegionState = {
    loading,
    config,
    activeElder,
    elderColors,
    activeLanguage,
    timezone,
    regionLanguages,
    setRegion,
    setLanguage,
    clearRegion,
    isRegionSet: config !== null,
  };

  return (
    <RegionContext.Provider value={value}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion(): RegionState {
  const ctx = useContext(RegionContext);
  if (!ctx) {
    throw new Error('useRegion must be used within <RegionProvider>');
  }
  return ctx;
}
