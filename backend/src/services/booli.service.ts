import * as XLSX from 'xlsx';
import { query } from '../config/database';

/**
 * Booli Service
 * Handles parsing Excel files from Booli and storing in PostgreSQL
 */

interface BooliSale {
  address: string;
  price: number | null;
  pricePerSqm: number | null;
  monthlyFee: number | null;
  propertyType: string | null;
  rooms: number | null;
  livingArea: number | null;
  daysOnBooli: number | null;
  saleStart: Date | null;
  soldDate: Date | null;
  status: string | null;
  category: 'nyproduktion' | 'succession';
  brf?: string | null;
  buildYear?: number | null;
  floor?: number | null;
}

interface BooliTrend {
  year: number;
  period: string;
  startDate: Date | null;
  endDate: Date | null;
  supply: number | null;
  avgBidPremium: number | null;
  medianDaysOnBooli: number | null;
  percentPriceReduced: number | null;
  avgPricePerSqm: number | null;
  avgFinalPrice: number | null;
  category: 'nyproduktion' | 'succession';
  region: string;
}

/**
 * Parse Excel date (Excel stores dates as numbers since 1900-01-01)
 */
function parseExcelDate(value: any): Date | null {
  if (!value) return null;

  // If already a Date object
  if (value instanceof Date) return value;

  // If it's a string, try to parse
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // If it's an Excel serial number
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return null;
    return new Date(date.y, date.m - 1, date.d, date.H || 0, date.M || 0, date.S || 0);
  }

  return null;
}

/**
 * Parse numeric value, handling both numbers and strings
 */
function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '' || value === '-') return null;
  const num = typeof value === 'string' ? parseFloat(value.replace(/\s/g, '').replace(',', '.')) : value;
  return isNaN(num) ? null : num;
}

/**
 * Parse sold properties Excel file (Nyproduktion or Succession)
 */
export async function parseSoldPropertiesFile(
  buffer: Buffer,
  category: 'nyproduktion' | 'succession'
): Promise<BooliSale[]> {
  console.log(`[Booli] Parsing sold ${category} file...`);

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON, starting from row 2 (skip metadata row, use row 2 as header)
  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
    raw: false
  }) as any[][];

  if (jsonData.length < 2) {
    throw new Error('Excel file has insufficient data');
  }

  // Row 2 (index 1) contains headers
  const headers = jsonData[1] as string[];

  // Rows from 3 onwards contain data (skip row 1: metadata, row 2: headers, row 3: medelvärde)
  const dataRows = jsonData.slice(3);

  const sales: BooliSale[] = [];

  for (const row of dataRows) {
    // Skip empty rows or footer rows
    if (!row[0] || String(row[0]).includes('Booli samlar')) continue;

    const sale: BooliSale = {
      address: String(row[0] || ''),
      price: category === 'nyproduktion' ? parseNumber(row[1]) : parseNumber(row[1]), // Pris or Slutpris
      pricePerSqm: category === 'nyproduktion' ? parseNumber(row[2]) : parseNumber(row[3]), // Kr/m²
      monthlyFee: parseNumber(row[category === 'nyproduktion' ? 3 : 4]),
      propertyType: row[category === 'nyproduktion' ? 4 : 5] || null,
      rooms: parseNumber(row[category === 'nyproduktion' ? 5 : 6]),
      livingArea: parseNumber(row[category === 'nyproduktion' ? 6 : 7]),
      daysOnBooli: parseNumber(row[category === 'nyproduktion' ? 7 : 8]),
      saleStart: parseExcelDate(row[category === 'nyproduktion' ? 8 : 9]),
      soldDate: parseExcelDate(row[category === 'nyproduktion' ? 9 : 10]),
      status: row[category === 'nyproduktion' ? 10 : 11] || null,
      category,
      brf: category === 'succession' ? (row[12] || null) : null,
      buildYear: category === 'succession' ? parseNumber(row[13]) : null,
      floor: category === 'succession' ? parseNumber(row[14]) : null
    };

    sales.push(sale);
  }

  console.log(`[Booli] Parsed ${sales.length} ${category} sales`);
  return sales;
}

/**
 * Parse market trends Excel file (Utbud - Nyproduktion or Succession)
 */
export async function parseMarketTrendsFile(
  buffer: Buffer,
  category: 'nyproduktion' | 'succession',
  region: string
): Promise<BooliTrend[]> {
  console.log(`[Booli] Parsing ${category} trends file for ${region}...`);

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
    raw: false
  }) as any[][];

  if (jsonData.length < 3) {
    throw new Error('Excel file has insufficient data');
  }

  // Find the header row (contains "År")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(5, jsonData.length); i++) {
    if (jsonData[i][0] === 'År') {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    throw new Error('Could not find header row in Excel file');
  }

  const headers = jsonData[headerIdx] as string[];
  const dataRows = jsonData.slice(headerIdx + 1);

  const trends: BooliTrend[] = [];

  for (const row of dataRows) {
    // Skip empty rows
    if (!row[0]) continue;

    const trend: BooliTrend = {
      year: parseNumber(row[0]) || 0,
      period: String(row[1] || ''),
      startDate: parseExcelDate(row[2]),
      endDate: parseExcelDate(row[3]),
      supply: parseNumber(row[4]),
      avgBidPremium: parseNumber(row[5]),
      medianDaysOnBooli: parseNumber(row[6]),
      percentPriceReduced: parseNumber(row[7]),
      avgPricePerSqm: parseNumber(row[8]),
      avgFinalPrice: parseNumber(row[9]),
      category,
      region
    };

    trends.push(trend);
  }

  console.log(`[Booli] Parsed ${trends.length} ${category} trend periods`);
  return trends;
}

/**
 * Clear all Booli data from database
 */
export async function clearBooliData(): Promise<void> {
  console.log('[Booli] Clearing existing data...');

  await query('DELETE FROM booli_sales');
  await query('DELETE FROM booli_trends');

  console.log('[Booli] Data cleared');
}

/**
 * Save sold properties to database
 */
export async function saveSoldProperties(sales: BooliSale[]): Promise<void> {
  console.log(`[Booli] Saving ${sales.length} sold properties...`);

  for (const sale of sales) {
    await query(`
      INSERT INTO booli_sales (
        address, price, price_per_sqm, monthly_fee, property_type,
        rooms, living_area, days_on_booli, sale_start, sold_date,
        status, category, brf, build_year, floor
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      sale.address,
      sale.price,
      sale.pricePerSqm,
      sale.monthlyFee,
      sale.propertyType,
      sale.rooms,
      sale.livingArea,
      sale.daysOnBooli,
      sale.saleStart,
      sale.soldDate,
      sale.status,
      sale.category,
      sale.brf,
      sale.buildYear,
      sale.floor
    ]);
  }

  console.log('[Booli] Sold properties saved');
}

/**
 * Save market trends to database
 */
export async function saveMarketTrends(trends: BooliTrend[]): Promise<void> {
  console.log(`[Booli] Saving ${trends.length} trend periods...`);

  for (const trend of trends) {
    await query(`
      INSERT INTO booli_trends (
        year, period, start_date, end_date, supply,
        avg_bid_premium, median_days_on_booli, percent_price_reduced,
        avg_price_per_sqm, avg_final_price, category, region
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (year, period, category, region)
      DO UPDATE SET
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        supply = EXCLUDED.supply,
        avg_bid_premium = EXCLUDED.avg_bid_premium,
        median_days_on_booli = EXCLUDED.median_days_on_booli,
        percent_price_reduced = EXCLUDED.percent_price_reduced,
        avg_price_per_sqm = EXCLUDED.avg_price_per_sqm,
        avg_final_price = EXCLUDED.avg_final_price
    `, [
      trend.year,
      trend.period,
      trend.startDate,
      trend.endDate,
      trend.supply,
      trend.avgBidPremium,
      trend.medianDaysOnBooli,
      trend.percentPriceReduced,
      trend.avgPricePerSqm,
      trend.avgFinalPrice,
      trend.category,
      trend.region
    ]);
  }

  console.log('[Booli] Market trends saved');
}

/**
 * Get all sold properties
 */
export async function getSoldProperties() {
  const result = await query(`
    SELECT
      id, address, price, price_per_sqm, monthly_fee, property_type,
      rooms, living_area, days_on_booli, sale_start, sold_date,
      status, category, brf, build_year, floor, created_at
    FROM booli_sales
    ORDER BY sold_date DESC NULLS LAST
  `);

  return result.rows;
}

/**
 * Get market trends
 */
export async function getMarketTrends() {
  const result = await query(`
    SELECT
      id, year, period, start_date, end_date, supply,
      avg_bid_premium, median_days_on_booli, percent_price_reduced,
      avg_price_per_sqm, avg_final_price, category, region, created_at
    FROM booli_trends
    ORDER BY year DESC, period DESC
  `);

  return result.rows;
}

/**
 * Get statistics summary
 */
export async function getStatisticsSummary() {
  // Count by category
  const salesCount = await query(`
    SELECT category, COUNT(*) as count
    FROM booli_sales
    GROUP BY category
  `);

  const trendsCount = await query(`
    SELECT category, COUNT(*) as count
    FROM booli_trends
    GROUP BY category
  `);

  // Average prices by category
  const avgPrices = await query(`
    SELECT
      category,
      AVG(price) as avg_price,
      AVG(price_per_sqm) as avg_price_per_sqm,
      MIN(sold_date) as earliest_sale,
      MAX(sold_date) as latest_sale
    FROM booli_sales
    WHERE price IS NOT NULL
    GROUP BY category
  `);

  return {
    sales: salesCount.rows,
    trends: trendsCount.rows,
    averages: avgPrices.rows
  };
}

export default {
  parseSoldPropertiesFile,
  parseMarketTrendsFile,
  clearBooliData,
  saveSoldProperties,
  saveMarketTrends,
  getSoldProperties,
  getMarketTrends,
  getStatisticsSummary
};
