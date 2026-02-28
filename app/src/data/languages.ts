export interface Language {
  code: string;
  name: string;
  nativeName: string;
  region: string;
  rtl: boolean;
}

export const LANGUAGES: Language[] = [
  // West Africa
  { code: 'en', name: 'English', nativeName: 'English', region: 'global', rtl: false },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá', region: 'westAfrica', rtl: false },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa', region: 'westAfrica', rtl: false },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo', region: 'westAfrica', rtl: false },
  { code: 'pcm', name: 'Nigerian Pidgin', nativeName: 'Pidgin', region: 'westAfrica', rtl: false },
  { code: 'tw', name: 'Twi', nativeName: 'Twi', region: 'westAfrica', rtl: false },

  // East Africa
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', region: 'eastAfrica', rtl: false },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', region: 'eastAfrica', rtl: false },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali', region: 'eastAfrica', rtl: false },

  // Southern Africa
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu', region: 'southernAfrica', rtl: false },
  { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa', region: 'southernAfrica', rtl: false },
  { code: 'st', name: 'Sesotho', nativeName: 'Sesotho', region: 'southernAfrica', rtl: false },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans', region: 'southernAfrica', rtl: false },

  // Latin America
  { code: 'es', name: 'Spanish', nativeName: 'Español', region: 'latinAmerica', rtl: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', region: 'latinAmerica', rtl: false },
  { code: 'qu', name: 'Quechua', nativeName: 'Runasimi', region: 'latinAmerica', rtl: false },

  // South Asia
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', region: 'southAsia', rtl: false },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', region: 'southAsia', rtl: false },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', region: 'southAsia', rtl: false },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', region: 'southAsia', rtl: true },

  // Southeast Asia
  { code: 'tl', name: 'Tagalog', nativeName: 'Tagalog', region: 'southeastAsia', rtl: false },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', region: 'southeastAsia', rtl: false },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', region: 'southeastAsia', rtl: false },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', region: 'southeastAsia', rtl: false },

  // MENA
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', region: 'mena', rtl: true },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', region: 'mena', rtl: true },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', region: 'mena', rtl: false },

  // Caribbean
  { code: 'ht', name: 'Haitian Creole', nativeName: 'Kreyòl Ayisyen', region: 'caribbean', rtl: false },
  { code: 'fr', name: 'French', nativeName: 'Français', region: 'caribbean', rtl: false },
  { code: 'jm', name: 'Jamaican Patois', nativeName: 'Patois', region: 'caribbean', rtl: false },

  // Pacific
  { code: 'sm', name: 'Samoan', nativeName: 'Gagana Sāmoa', region: 'pacific', rtl: false },
  { code: 'mi', name: 'Māori', nativeName: 'Te Reo Māori', region: 'pacific', rtl: false },
  { code: 'fj', name: 'Fijian', nativeName: 'Na Vosa Vakaviti', region: 'pacific', rtl: false },
  { code: 'to', name: 'Tongan', nativeName: 'Lea Fakatonga', region: 'pacific', rtl: false },
];

export function getLanguagesByRegion(region: string): Language[] {
  return LANGUAGES.filter((l) => l.region === region || l.region === 'global');
}

export function getLanguageByCode(code: string): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}
