import axios from 'axios';
import type {
  GeoJSONPolygon,
  FindDeSoResponse,
  AreaMetrics,
  TimeSeriesData
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
