import { ElderRegionKey } from '../theme/colors';

export interface Region {
  id: ElderRegionKey;
  name: string;
  emoji: string;
  elderId: string;
  timezone: string;
  population: string;
}

export const REGIONS: Region[] = [
  {
    id: 'westAfrica',
    name: 'West Africa',
    emoji: '🌍',
    elderId: 'baba-adewale',
    timezone: 'Africa/Lagos',
    population: '400M+',
  },
  {
    id: 'eastAfrica',
    name: 'East Africa',
    emoji: '🌍',
    elderId: 'mama-zawadi',
    timezone: 'Africa/Nairobi',
    population: '300M+',
  },
  {
    id: 'southernAfrica',
    name: 'Southern Africa',
    emoji: '🌍',
    elderId: 'gogo-thandi',
    timezone: 'Africa/Johannesburg',
    population: '200M+',
  },
  {
    id: 'latinAmerica',
    name: 'Latin America',
    emoji: '🌎',
    elderId: 'don-esteban',
    timezone: 'America/Bogota',
    population: '650M+',
  },
  {
    id: 'southAsia',
    name: 'South Asia',
    emoji: '🌏',
    elderId: 'dada-rajesh',
    timezone: 'Asia/Kolkata',
    population: '1.9B+',
  },
  {
    id: 'southeastAsia',
    name: 'Southeast Asia',
    emoji: '🌏',
    elderId: 'lola-maria',
    timezone: 'Asia/Manila',
    population: '680M+',
  },
  {
    id: 'mena',
    name: 'Middle East & North Africa',
    emoji: '🌍',
    elderId: 'sitt-fatima',
    timezone: 'Asia/Dubai',
    population: '400M+',
  },
  {
    id: 'caribbean',
    name: 'Caribbean',
    emoji: '🌎',
    elderId: 'tantie-rose',
    timezone: 'America/Port-au-Prince',
    population: '44M+',
  },
  {
    id: 'pacific',
    name: 'Pacific Islands',
    emoji: '🌏',
    elderId: 'aunty-leilani',
    timezone: 'Pacific/Auckland',
    population: '12M+',
  },
];

export function getRegionById(id: string): Region | undefined {
  return REGIONS.find((r) => r.id === id);
}
