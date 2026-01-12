import { BooliPropertySale, BooliMetrics, SCBTimeSeriesPoint } from '../models/types';
import { getCachedOrFetch, generateCacheKey } from './cache.service';

/**
 * Generate realistic mock property sales data for a DeSO area
 */
function generateMockSales(desoCode: string, count: number = 150): BooliPropertySale[] {
  const sales: BooliPropertySale[] = [];
  const now = new Date();

  // Base prices vary by DeSO (use hash of deso_code for consistency)
  const hash = desoCode.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const basePrice = 2000000 + (hash % 3000000);
  const basePricePerSqm = 40000 + (hash % 40000);

  for (let i = 0; i < count; i++) {
    // Random date in last 2 years
    const daysAgo = Math.floor(Math.random() * 730);
    const soldDate = new Date(now);
    soldDate.setDate(soldDate.getDate() - daysAgo);

    // Property details
    const livingArea = 30 + Math.floor(Math.random() * 120); // 30-150 m²
    const rooms = livingArea < 40 ? 1 : livingArea < 70 ? 2 : livingArea < 100 ? 3 : 4;

    // Construction year (mix of old and new)
    const isNewConstruction = Math.random() < 0.15; // 15% nyproduktion
    const constructionYear = isNewConstruction
      ? 2020 + Math.floor(Math.random() * 5)
      : 1950 + Math.floor(Math.random() * 70);

    // Price (nyproduktion är dyrare)
    const priceMultiplier = isNewConstruction ? 1.2 : 1.0;
    const pricePerSqm = Math.floor(basePricePerSqm * priceMultiplier * (0.9 + Math.random() * 0.2));
    const soldPrice = livingArea * pricePerSqm;
    const listPrice = soldPrice * (0.95 + Math.random() * 0.1); // List price usually higher

    // Object type
    const objectTypes: Array<'Lägenhet' | 'Villa' | 'Radhus'> = ['Lägenhet', 'Villa', 'Radhus'];
    const objectType = objectTypes[Math.floor(Math.random() * objectTypes.length)];

    // Location (mock coordinates)
    const lat = 59.3 + (Math.random() * 0.2);
    const lng = 18.0 + (Math.random() * 0.2);

    sales.push({
      id: `${desoCode}-${i}`,
      sold_date: soldDate,
      sold_price: soldPrice,
      list_price: listPrice,
      living_area: livingArea,
      rooms,
      construction_year: constructionYear,
      object_type: objectType,
      address: `Exempelgatan ${i + 1}`,
      deso_code: desoCode,
      lat,
      lng,
      is_new_construction: isNewConstruction,
      price_per_sqm: pricePerSqm
    });
  }

  return sales;
}

/**
 * Calculate metrics from sales data
 */
function calculateMetrics(sales: BooliPropertySale[]): BooliMetrics {
  const newProduction = sales.filter(s => s.is_new_construction);
  const succession = sales.filter(s => !s.is_new_construction);

  const avgPrice = sales.reduce((sum, s) => sum + s.sold_price, 0) / sales.length;
  const avgPricePerSqm = sales.reduce((sum, s) => sum + s.price_per_sqm, 0) / sales.length;

  const newProdAvgPrice = newProduction.length > 0
    ? newProduction.reduce((sum, s) => sum + s.sold_price, 0) / newProduction.length
    : 0;
  const newProdAvgPricePerSqm = newProduction.length > 0
    ? newProduction.reduce((sum, s) => sum + s.price_per_sqm, 0) / newProduction.length
    : 0;

  const succAvgPrice = succession.length > 0
    ? succession.reduce((sum, s) => sum + s.sold_price, 0) / succession.length
    : 0;
  const succAvgPricePerSqm = succession.length > 0
    ? succession.reduce((sum, s) => sum + s.price_per_sqm, 0) / succession.length
    : 0;

  // Generate price trend (last 12 months)
  const priceTrend: SCBTimeSeriesPoint[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now);
    monthStart.setMonth(monthStart.getMonth() - i);
    monthStart.setDate(1);

    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const monthSales = sales.filter(
      s => s.sold_date >= monthStart && s.sold_date < monthEnd
    );

    const monthAvgPrice = monthSales.length > 0
      ? monthSales.reduce((sum, s) => sum + s.price_per_sqm, 0) / monthSales.length
      : avgPricePerSqm;

    priceTrend.push({
      date: monthStart.toISOString().split('T')[0],
      value: Math.round(monthAvgPrice)
    });
  }

  return {
    total_sales: sales.length,
    avg_price: Math.round(avgPrice),
    avg_price_per_sqm: Math.round(avgPricePerSqm),
    new_production: {
      count: newProduction.length,
      avg_price: Math.round(newProdAvgPrice),
      avg_price_per_sqm: Math.round(newProdAvgPricePerSqm)
    },
    succession: {
      count: succession.length,
      avg_price: Math.round(succAvgPrice),
      avg_price_per_sqm: Math.round(succAvgPricePerSqm)
    },
    price_trend: priceTrend
  };
}

/**
 * Get property sales for a DeSO area (mock)
 */
export async function getPropertySales(desoCode: string): Promise<BooliPropertySale[]> {
  const cacheKey = generateCacheKey('booli', `sales-${desoCode}`, {});

  return getCachedOrFetch(
    cacheKey,
    'booli',
    async () => {
      console.log(`[Booli Mock] Generating sales data for DeSO ${desoCode}`);

      // Generate consistent mock data based on desoCode
      const sales = generateMockSales(desoCode, 150);

      return sales;
    },
    86400 // 24h cache
  );
}

/**
 * Get Booli metrics for a DeSO area (mock)
 */
export async function getBooliMetrics(desoCode: string): Promise<BooliMetrics> {
  const cacheKey = generateCacheKey('booli', `metrics-${desoCode}`, {});

  return getCachedOrFetch(
    cacheKey,
    'booli',
    async () => {
      console.log(`[Booli Mock] Calculating metrics for DeSO ${desoCode}`);

      const sales = await getPropertySales(desoCode);
      const metrics = calculateMetrics(sales);

      return metrics;
    },
    86400
  );
}

/**
 * Get recent sales (last 30 days) for a DeSO area
 */
export async function getRecentSales(desoCode: string, days: number = 30): Promise<BooliPropertySale[]> {
  const sales = await getPropertySales(desoCode);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return sales.filter(s => s.sold_date >= cutoffDate);
}

/**
 * Search properties by criteria
 */
export async function searchProperties(
  desoCode: string,
  criteria: {
    minPrice?: number;
    maxPrice?: number;
    minArea?: number;
    maxArea?: number;
    objectType?: 'Lägenhet' | 'Villa' | 'Radhus';
    newConstructionOnly?: boolean;
  }
): Promise<BooliPropertySale[]> {
  const sales = await getPropertySales(desoCode);

  return sales.filter(sale => {
    if (criteria.minPrice && sale.sold_price < criteria.minPrice) return false;
    if (criteria.maxPrice && sale.sold_price > criteria.maxPrice) return false;
    if (criteria.minArea && sale.living_area < criteria.minArea) return false;
    if (criteria.maxArea && sale.living_area > criteria.maxArea) return false;
    if (criteria.objectType && sale.object_type !== criteria.objectType) return false;
    if (criteria.newConstructionOnly && !sale.is_new_construction) return false;
    return true;
  });
}

export default {
  getPropertySales,
  getBooliMetrics,
  getRecentSales,
  searchProperties
};
