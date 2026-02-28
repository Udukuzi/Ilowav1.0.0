/**
 * Hook for browsing real radio stations via radio-browser.info API.
 * Supports two modes:
 * - Regional: stations from user's selected region (with curated fallbacks)
 * - Genre: global genre-based stations (Lofi, Hip-hop, Jazz, etc.)
 */

import { useState, useEffect, useCallback } from 'react';
import { BrowseStation } from '../types/radio';
import {
  fetchRegionStations,
  fetchByGenre,
  searchStations,
  reportClick,
  clearCache,
  GLOBAL_GENRES,
} from '../lib/radio/radio-browser';

export type BrowseMode = 'regional' | 'global';

interface UseRadioBrowserResult {
  stations: BrowseStation[];
  loading: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  onStationClick: (station: BrowseStation) => void;
  searchQuery: string;
  hasMore: boolean;
  // Mode switching
  mode: BrowseMode;
  setMode: (mode: BrowseMode) => void;
  // Genre selection (for global mode)
  selectedGenre: string | null;
  selectGenre: (genreId: string) => Promise<void>;
  genres: typeof GLOBAL_GENRES;
}

export function useRadioBrowser(region: string): UseRadioBrowserResult {
  const [stations, setStations] = useState<BrowseStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [mode, setModeState] = useState<BrowseMode>('regional');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  const PAGE_SIZE = 30;

  // Fetch stations for the current region
  const fetchRegional = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRegionStations(region, PAGE_SIZE);
      setStations(result);
      setPage(0);
      setHasMore(result.length >= PAGE_SIZE);
    } catch (err: any) {
      console.error('[useRadioBrowser] Fetch error:', err);
      setError('Could not load stations. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, [region]);

  // Fetch stations for a genre
  const fetchGenreStations = useCallback(async (genreId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchByGenre(genreId, PAGE_SIZE);
      setStations(result);
      setHasMore(false); // Genres don't paginate
    } catch (err: any) {
      console.error('[useRadioBrowser] Genre fetch error:', err);
      setError('Could not load genre stations.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch when region changes (only if in regional mode)
  useEffect(() => {
    if (mode === 'regional') {
      setSearchQuery('');
      fetchRegional();
    }
  }, [region, mode, fetchRegional]);

  // Switch mode
  const setMode = useCallback((newMode: BrowseMode) => {
    setModeState(newMode);
    setSearchQuery('');
    setError(null);
    
    if (newMode === 'regional') {
      setSelectedGenre(null);
      fetchRegional();
    } else {
      // Default to first genre when switching to global
      const firstGenre = GLOBAL_GENRES[0].id;
      setSelectedGenre(firstGenre);
      fetchGenreStations(firstGenre);
    }
  }, [fetchRegional, fetchGenreStations]);

  // Select a genre (global mode)
  const selectGenre = useCallback(async (genreId: string) => {
    setSelectedGenre(genreId);
    setSearchQuery('');
    await fetchGenreStations(genreId);
  }, [fetchGenreStations]);

  // Search stations
  const search = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      // Reset to current mode's stations
      if (mode === 'regional') {
        await fetchRegional();
      } else if (selectedGenre) {
        await fetchGenreStations(selectedGenre);
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await searchStations(query, PAGE_SIZE);
      setStations(result);
      setHasMore(false); // Search doesn't paginate
    } catch (err: any) {
      console.error('[useRadioBrowser] Search error:', err);
      setError('Search failed. Try again.');
    } finally {
      setLoading(false);
    }
  }, [mode, selectedGenre, fetchRegional, fetchGenreStations]);

  // Load more stations (regional mode only)
  const loadMore = useCallback(async () => {
    if (loading || !hasMore || searchQuery || mode !== 'regional') return;

    setLoading(true);
    try {
      const nextPage = page + 1;
      const result = await fetchRegionStations(region, PAGE_SIZE * (nextPage + 1));
      setStations(result);
      setPage(nextPage);
      setHasMore(result.length > stations.length);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, searchQuery, page, region, stations.length, mode]);

  // Report click to radio-browser (community contribution)
  const onStationClick = useCallback((station: BrowseStation) => {
    // Don't report clicks for curated stations (they have 'curated-' prefix)
    if (!station.stationuuid.startsWith('curated-')) {
      reportClick(station.stationuuid);
    }
  }, []);

  // Refresh (clear cache + refetch)
  const refresh = useCallback(async () => {
    if (mode === 'regional') {
      clearCache(region);
      setSearchQuery('');
      await fetchRegional();
    } else if (selectedGenre) {
      clearCache(`genre:${selectedGenre}`);
      setSearchQuery('');
      await fetchGenreStations(selectedGenre);
    }
  }, [region, mode, selectedGenre, fetchRegional, fetchGenreStations]);

  return {
    stations,
    loading,
    error,
    search,
    refresh,
    loadMore,
    onStationClick,
    searchQuery,
    hasMore,
    mode,
    setMode,
    selectedGenre,
    selectGenre,
    genres: GLOBAL_GENRES,
  };
}
