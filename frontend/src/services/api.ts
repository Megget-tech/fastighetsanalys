import axios from 'axios';
import type {
  GeoJSONPolygon,
  FindDeSoResponse,
  AreaMetrics,
  TimeSeriesData
} from '../types';

// VITE_API_URL kan vara en full URL (http://localhost:3000/api) eller bara backendens värdnamn,
// som Render ger via render.yaml (fdata-backend.onrender.com) – då läggs https:// och /api på.
function normalizeApiUrl(raw: string | undefined): string {
  let url = (raw || 'http://localhost:3000/api').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(url)) url = `https://${url}`;
  if (!/\/api$/.test(url)) url = `${url}/api`;
  return url;
}
const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      console.error('[API] Response error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('[API] No response received:', error.request);
    } else {
      console.error('[API] Error:', error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * Find DeSO areas by polygon
 */
export async function findDeSoByPolygon(polygon: GeoJSONPolygon): Promise<FindDeSoResponse> {
  const response = await api.post<FindDeSoResponse>('/areas/find-deso', { polygon });
  return response.data;
}

/**
 * Get all metrics for a DeSO area
 */
export async function getMetrics(desoCode: string): Promise<AreaMetrics> {
  const response = await api.get<AreaMetrics>(`/data/metrics/${desoCode}`);
  return response.data;
}

/**
 * Get aggregated metrics for multiple DeSO areas
 */
export async function getAggregatedMetrics(desoCodes: string[]): Promise<any> {
  const response = await api.post('/data/metrics/aggregated', { deso_codes: desoCodes });
  return response.data;
}

/**
 * Get time series data for a metric
 */
export async function getTimeSeries(
  desoCode: string,
  metric: 'income' | 'population' | 'education'
): Promise<TimeSeriesData> {
  const response = await api.get<TimeSeriesData>(`/data/timeseries/${desoCode}/${metric}`);
  return response.data;
}

/**
 * Get DeSO boundaries as GeoJSON
 */
export async function getDeSoBoundaries(desoCodes: string[]) {
  const response = await api.get(`/areas/boundaries/deso`, {
    params: { codes: desoCodes.join(',') }
  });
  return response.data;
}

/**
 * Search for property by fastighetsbeteckning
 */
export async function searchProperty(beteckning: string) {
  const response = await api.get('/properties/search', {
    params: { q: beteckning }
  });
  return response.data;
}

/**
 * Validate fastighetsbeteckning format
 */
export async function validateProperty(beteckning: string) {
  const response = await api.get('/properties/validate', {
    params: { q: beteckning }
  });
  return response.data;
}

/**
 * Health check
 */
export async function healthCheck() {
  const response = await axios.get(`${API_URL.replace('/api', '')}/health`);
  return response.data;
}

/**
 * Upload Booli data files
 */
export async function uploadBooliData(
  files: {
    soldNew: File;
    soldOld: File;
    trendsNew: File;
    trendsOld: File;
  },
  region: string
) {
  const formData = new FormData();
  formData.append('soldNew', files.soldNew);
  formData.append('soldOld', files.soldOld);
  formData.append('trendsNew', files.trendsNew);
  formData.append('trendsOld', files.trendsOld);
  formData.append('region', region);

  const response = await axios.post(`${API_URL}/booli/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    timeout: 60000 // 60 seconds for file upload
  });

  return response.data;
}

/**
 * Get all sold properties
 */
export async function getBooliSales() {
  const response = await api.get('/booli/sales');
  return response.data;
}

/**
 * Get market trends
 */
export async function getBooliTrends() {
  const response = await api.get('/booli/trends');
  return response.data;
}

/**
 * Get Booli statistics summary
 */
export async function getBooliSummary() {
  const response = await api.get('/booli/summary');
  return response.data;
}

/**
 * Clear all Booli data
 */
export async function clearBooliData() {
  const response = await api.delete('/booli/clear');
  return response.data;
}

/**
 * Quick Analysis result type
 */
export interface QuickAnalysisResult {
  success: boolean;
  recommendation?: 'GO' | 'NO-GO' | 'FURTHER-ANALYSIS';
  confidence?: 'high' | 'medium' | 'low';
  rationale?: string;
  error?: string;
  files?: {
    pdf?: string;
    map?: string;
    json?: string;
  };
  marketAnalysis?: string;
  locationAnalysis?: string;
  synthesis?: string;
}

/**
 * Analyserna körs som bakgrundsjobb i backend: POST startar (svar 202 { jobId }),
 * sedan frågar vi efter status tills jobbet är klart. Inga långa HTTP-anrop som kan brytas.
 */
const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ERRORS = 5;

async function startAndWaitForJob<T>(
  endpoint: 'quick' | 'full',
  inputData: any,
  nyproduktionFile?: File,
  onProgress?: (elapsedSeconds: number) => void
): Promise<T> {
  const formData = new FormData();
  formData.append('inputData', JSON.stringify(inputData));
  if (nyproduktionFile) {
    formData.append('nyproduktionFile', nyproduktionFile);
  }

  const start = await axios.post<{ success: boolean; jobId?: string; error?: string }>(
    `${API_URL}/analysis/${endpoint}`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
      validateStatus: () => true,
    }
  );
  if (!start.data?.jobId) {
    return { success: false, error: start.data?.error || `Analysen kunde inte startas (HTTP ${start.status})` } as T;
  }

  const jobId = start.data.jobId;
  let errors = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const { data } = await axios.get(`${API_URL}/analysis/jobs/${jobId}`, { timeout: 15000 });
      errors = 0;
      onProgress?.(data.elapsedSeconds);
      if (data.status === 'done' || data.status === 'error') {
        return (data.result || { success: false, error: data.error || 'Analysen misslyckades' }) as T;
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return { success: false, error: err.response.data?.error || 'Analysjobbet försvann (tjänsten startades om).' } as T;
      }
      // Tillfälligt nätverksfel: försök igen några gånger innan vi ger upp
      if (++errors >= MAX_POLL_ERRORS) {
        return { success: false, error: 'Tappade kontakten med servern under analysen.' } as T;
      }
    }
  }
}

/**
 * Run quick analysis on collected data
 */
export async function runQuickAnalysis(
  inputData: any,
  nyproduktionFile?: File,
  onProgress?: (elapsedSeconds: number) => void
): Promise<QuickAnalysisResult> {
  return startAndWaitForJob<QuickAnalysisResult>('quick', inputData, nyproduktionFile, onProgress);
}

/**
 * Full Analysis result type
 */
export interface FullAnalysisResult {
  success: boolean;
  recommendation?: 'GO' | 'NO-GO' | 'FURTHER-ANALYSIS';
  confidence?: 'high' | 'medium' | 'low';
  rationale?: string;
  qaDecision?: 'APPROVED' | 'REJECTED' | 'CONDITIONAL';
  keyRecommendations?: string[];
  error?: string;
  files?: {
    pdf?: string;
    executivePdf?: string;
    map?: string;
    json?: string;
  };
  fullResults?: any;
}

/**
 * Run full analysis on collected data
 * Note: This takes 5-15 minutes to complete
 */
export async function runFullAnalysis(
  inputData: any,
  nyproduktionFile?: File,
  onProgress?: (elapsedSeconds: number) => void
): Promise<FullAnalysisResult> {
  return startAndWaitForJob<FullAnalysisResult>('full', inputData, nyproduktionFile, onProgress);
}

/**
 * Get analysis file (PDF, etc.)
 */
export function getAnalysisFileUrl(fileUrl: string, filename: string): string {
  // fileUrl kommer från backend som /analysis/jobs/<id>/files/<nyckel>
  return `${API_URL}${fileUrl}?name=${encodeURIComponent(filename)}`;
}

export default {
  findDeSoByPolygon,
  getMetrics,
  getAggregatedMetrics,
  getTimeSeries,
  getDeSoBoundaries,
  searchProperty,
  validateProperty,
  healthCheck,
  uploadBooliData,
  getBooliSales,
  getBooliTrends,
  getBooliSummary,
  clearBooliData
};
