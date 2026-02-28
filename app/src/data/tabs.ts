export interface Tab {
  id: string;
  name: string;
  title: { [lang: string]: string };
  icon: string;
  iconInactive: string;
  description: string;
}

export const TABS: Tab[] = [
  {
    id: 'home',
    name: 'Home',
    title: {
      en: 'Home',
      yo: 'Ilé',
      sw: 'Nyumbani',
      es: 'Inicio',
      hi: 'घर',
      ar: 'بيت',
    },
    icon: 'home-active',
    iconInactive: 'home-inactive',
    description: 'Daily Oracle feed, trending predictions, Elder messages',
  },
  {
    id: 'radio',
    name: 'Radio',
    title: {
      en: 'Radio',
      yo: 'Rédíò',
      sw: 'Redio',
      es: 'Radio',
      hi: 'रेडियो',
      ar: 'راديو',
    },
    icon: 'radio-active',
    iconInactive: 'radio-inactive',
    description: 'Live 24/7 radio, call-in, DJ tips, community chat',
  },
  {
    id: 'markets',
    name: 'Markets',
    title: {
      en: 'Markets',
      yo: 'Ọjà',
      sw: 'Masoko',
      es: 'Mercados',
      hi: 'बाज़ार',
      ar: 'الأسواق',
    },
    icon: 'markets-active',
    iconInactive: 'markets-inactive',
    description: 'Browse/create prediction markets, voice betting',
  },
  {
    id: 'ai',
    name: 'AI',
    title: {
      en: 'AI',
      yo: 'AI',
      sw: 'AI',
      es: 'IA',
      hi: 'एआई',
      ar: 'الذكاء الاصطناعي',
    },
    icon: 'ai-active',
    iconInactive: 'ai-inactive',
    description: 'Chat with Elder, AI predictions, market analysis',
  },
  {
    id: 'profile',
    name: 'Profile',
    title: {
      en: 'Profile',
      yo: 'Profáìlì',
      sw: 'Wasifu',
      es: 'Perfil',
      hi: 'प्रोफ़ाइल',
      ar: 'الملف الشخصي',
    },
    icon: 'profile-active',
    iconInactive: 'profile-inactive',
    description: 'Voice NFTs, stats, guardians, settings',
  },
];
