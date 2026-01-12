import { create } from 'zustand';
import type {
  GeoJSONPolygon,
  FindDeSoResponse,
  AreaMetrics,
  TimeSeriesData
} from '../types';

export interface PropertyPoint {
  coordinates: [number, number]; // [lon, lat]
  beteckning: string;
}

interface AnalysisState {
  // Selected area
  selectedPolygon: GeoJSONPolygon | null;
  desoResult: FindDeSoResponse | null;
  selectedDesoCodes: string[]; // User-selected DeSO codes from checklist
  propertyPoint: PropertyPoint | null; // Property search result as point

  // Metrics data
  metrics: AreaMetrics | null;
  aggregatedMetrics: any | null; // Aggregated metrics for multiple areas
  timeSeries: TimeSeriesData | null;
  selectedMetric: 'income' | 'population' | 'education';

  // UI state
  loading: boolean;
  error: string | null;

  // Actions
  setSelectedPolygon: (polygon: GeoJSONPolygon | null) => void;
  setDesoResult: (result: FindDeSoResponse | null) => void;
  setSelectedDesoCodes: (codes: string[]) => void;
  setPropertyPoint: (point: PropertyPoint | null) => void;
  setMetrics: (metrics: AreaMetrics | null) => void;
  setAggregatedMetrics: (metrics: any | null) => void;
  setTimeSeries: (timeSeries: TimeSeriesData | null) => void;
  setSelectedMetric: (metric: 'income' | 'population' | 'education') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  selectedPolygon: null,
  desoResult: null,
  selectedDesoCodes: [] as string[],
  propertyPoint: null,
  metrics: null,
  aggregatedMetrics: null,
  timeSeries: null,
  selectedMetric: 'income' as const,
  loading: false,
  error: null
};

export const useAnalysisStore = create<AnalysisState>((set) => ({
  ...initialState,

  setSelectedPolygon: (polygon) => set({ selectedPolygon: polygon }),

  setDesoResult: (result) => set({ desoResult: result }),

  setSelectedDesoCodes: (codes) => set({ selectedDesoCodes: codes }),

  setPropertyPoint: (point) => set({ propertyPoint: point }),

  setMetrics: (metrics) => set({ metrics }),

  setAggregatedMetrics: (aggregatedMetrics) => set({ aggregatedMetrics }),

  setTimeSeries: (timeSeries) => set({ timeSeries }),

  setSelectedMetric: (metric) => set({ selectedMetric: metric }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState)
}));
