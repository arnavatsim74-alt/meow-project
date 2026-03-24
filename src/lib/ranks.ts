import { supabase } from '@/integrations/supabase/client';

export interface RankInfo {
  name: string;
  minHours: number;
  maxHours: number | null;
}

// Default fallback ranks (used if DB fetch fails)
const DEFAULT_RANKS: RankInfo[] = [
  { name: 'Cadet', minHours: 0, maxHours: 40 },
  { name: 'First Officer', minHours: 40, maxHours: 80 },
  { name: 'Captain', minHours: 80, maxHours: 150 },
  { name: 'Commander', minHours: 150, maxHours: 250 },
  { name: 'Vladimir', minHours: 250, maxHours: null },
];

// Cached ranks from DB
let cachedRanks: RankInfo[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export async function fetchRanksFromDB(): Promise<RankInfo[]> {
  if (cachedRanks && Date.now() - cacheTime < CACHE_TTL) {
    return cachedRanks;
  }
  
  const { data, error } = await supabase
    .from('ranks')
    .select('name, min_hours, sort_order')
    .order('sort_order', { ascending: true });
  
  if (error || !data || data.length === 0) {
    return DEFAULT_RANKS;
  }
  
  const ranks: RankInfo[] = data.map((r, i) => ({
    name: r.name,
    minHours: Number(r.min_hours),
    maxHours: i < data.length - 1 ? Number(data[i + 1].min_hours) : null,
  }));
  
  cachedRanks = ranks;
  cacheTime = Date.now();
  return ranks;
}

// Synchronous versions using cached data or defaults
export function getRanks(): RankInfo[] {
  return cachedRanks || DEFAULT_RANKS;
}

export const RANKS = DEFAULT_RANKS; // backward compat

export function getRankByHours(totalHours: number): RankInfo {
  const ranks = getRanks();
  for (let i = ranks.length - 1; i >= 0; i--) {
    if (totalHours >= ranks[i].minHours) {
      return ranks[i];
    }
  }
  return ranks[0];
}

export function getNextRank(currentRank: RankInfo): RankInfo | null {
  const ranks = getRanks();
  const currentIndex = ranks.findIndex(r => r.name === currentRank.name);
  if (currentIndex < ranks.length - 1) {
    return ranks[currentIndex + 1];
  }
  return null;
}

export function getProgressToNextRank(totalHours: number): { progress: number; hoursNeeded: number; hoursToGo: number } {
  const currentRank = getRankByHours(totalHours);
  const nextRank = getNextRank(currentRank);
  
  if (!nextRank) {
    return { progress: 100, hoursNeeded: 0, hoursToGo: 0 };
  }
  
  const hoursInCurrentTier = totalHours - currentRank.minHours;
  const hoursNeededForTier = nextRank.minHours - currentRank.minHours;
  const progress = Math.min((hoursInCurrentTier / hoursNeededForTier) * 100, 100);
  const hoursToGo = nextRank.minHours - totalHours;
  
  return { progress, hoursNeeded: nextRank.minHours, hoursToGo };
}
