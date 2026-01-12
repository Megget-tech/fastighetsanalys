import axios from 'axios';
import dotenv from 'dotenv';
import { queueSCBRequest } from '../utils/rate-limiter';
import { getCachedOrFetch, generateCacheKey } from './cache.service';
import {
  getTotalPopulationFromSCB,
  getAgeDistributionFromSCB,
  getHistoricalPopulationFromSCB,
  getIncomeDataFromSCB,
  getEducationDataFromSCB,
  getMigrationDataFromSCB,
  getOriginDataFromSCB,
  getHouseholdDataFromSCB,
  getHousingTypeDataFromSCB,
  getTenureFormDataFromSCB,
  getEconomicStandardFromSCB,
  getEarnedIncomeFromSCB,
  getEconomicStandardForKommun,
  getEarnedIncomeForKommun,
  getOriginDataForKommun,
  getPopulationDataForKommun,
  getHouseholdDataForKommun,
  getHousingTypeDataForKommun,
  getTenureFormDataForKommun,
  getVehicleDataFromSCB,
  getVehicleDataForKommun
} from './scb-api.service';
import {
  IncomeMetrics,
  PopulationMetrics,
  EducationMetrics,
  MigrationMetrics,
  OriginMetrics,
  HouseholdMetrics,
  HousingTypeMetrics,
  TenureFormMetrics,
  EconomicStandardMetrics,
  EarnedIncomeMetrics,
  VehicleMetrics,
  SCBTimeSeries
} from '../models/types';

dotenv.config();

const SCB_API_BASE = process.env.SCB_API_BASE_URL || 'https://statistikdatabasen.scb.se/api/v2';

// SCB Table IDs (from plan)
const TABLES = {
  INCOME: 'HE0110T01',        // Inkomst per DeSO
  POPULATION: 'BE0101T01',    // Befolkning per DeSO
  EDUCATION: 'UF0506T01',     // Utbildningsnivå per DeSO
  MIGRATION: 'BE0101T07',     // Flyttmönster per DeSO
  DEMOGRAPHICS: 'BE0101T04'   // Ålder & kön per DeSO
};

/**
 * Fetch data from SCB PxWebAPI 2.0
 */
async function fetchFromSCB(tableId: string, query: any): Promise<any> {
  const url = `${SCB_API_BASE}/tables/${tableId}/data`;

  try {
    const response = await axios.post(url, { query }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 45000
    });

    return response.data;
  } catch (error: any) {
    console.error(`[SCB] Error fetching from table ${tableId}:`, error.message);

    if (error.response) {
      console.error(`[SCB] Response:`, error.response.data);
    }

    throw new Error(`SCB API error: ${error.message}`);
  }
}

/**
 * Get income metrics for a DeSO area
 */
export async function getIncomeMetrics(desoCode: string): Promise<IncomeMetrics> {
  const cacheKey = generateCacheKey('scb', `income-${desoCode}`, {});

  return getCachedOrFetch(
    cacheKey,
    'scb',
    async () => {
      console.log(`[SCB] Fetching income for DeSO ${desoCode}`);

      try {
        // Hämta riktig data från SCB API
        const incomeData = await getIncomeDataFromSCB(desoCode);

        if (!incomeData) {
          console.warn(`[SCB] Failed to fetch income data for ${desoCode}, using mock data`);
          return getMockIncomeMetrics();
        }

        return {
          median_income: incomeData.median_income,
          mean_income: incomeData.mean_income,
          kommun_median: incomeData.kommun_median || 310000,
          riket_median: incomeData.riket_median || 325000,
          percentile_20: incomeData.median_income * 0.75,
          percentile_80: incomeData.median_income * 1.4,
          year: '2023'  // Income data is from 2023 (latest available)
        };
      } catch (error) {
        console.error(`[SCB] Error fetching income metrics:`, error);
        return getMockIncomeMetrics();
      }
    },
    86400 // 24h cache
  );
}

/**
 * Fallback: Mock income metrics
 */
function getMockIncomeMetrics(): IncomeMetrics {
  return {
    median_income: 320000 + Math.random() * 100000,
    mean_income: 340000 + Math.random() * 100000,
    kommun_median: 310000,
    riket_median: 325000,
    percentile_20: 250000,
    percentile_80: 450000
  };
}

/**
 * Get population metrics for a DeSO area
 */
export async function getPopulationMetrics(desoCode: string, kommunCode?: string): Promise<PopulationMetrics> {
  const cacheKey = generateCacheKey('scb', `population-${desoCode}`, {});

  return getCachedOrFetch(
    cacheKey,
    'scb',
    async () => {
      console.log(`[SCB] Fetching population for DeSO ${desoCode}`);

      try {
        // Hämta riktig data från SCB API
        const currentYear = '2024';
        const previousYear = '2023';

        console.log(`[SCB] Fetching age distributions for ${desoCode}: 2019, 2023, 2024`);

        const [
          ageDistribution2024,
          ageDistribution2023,
          kommunPopData,
          ageDistribution2019
        ] = await Promise.all([
          getAgeDistributionFromSCB(desoCode, currentYear),  // 2024
          getAgeDistributionFromSCB(desoCode, previousYear), // 2023
          kommunCode ? getPopulationDataForKommun(kommunCode, previousYear) : Promise.resolve(null),
          getAgeDistributionFromSCB(desoCode, '2019')
        ]);

        console.log(`[SCB] Age distributions fetched - 2019: ${!!ageDistribution2019}, 2023: ${!!ageDistribution2023}, 2024: ${!!ageDistribution2024}`);

        // Beräkna total befolkning från åldersfördelning (mer pålitligt än separata API-anrop)
        let pop2024 = ageDistribution2024
          ? Object.values(ageDistribution2024).reduce((sum, val) => sum + val, 0)
          : 0;

        const pop2023 = ageDistribution2023
          ? Object.values(ageDistribution2023).reduce((sum, val) => sum + val, 0)
          : 0;

        // Om 2024 saknar data (är 0), använd 2023 som current istället
        const currentPopulation = pop2024 > 0 ? pop2024 : pop2023;
        const previousPopulation = pop2024 > 0 ? pop2023 : null; // Om vi använder 2023 som current, har vi ingen previous

        console.log(`[SCB] Calculated populations - 2024: ${pop2024}, 2023: ${pop2023}, using current: ${currentPopulation}`);

        // Om SCB API misslyckas, använd fallback
        if (!currentPopulation || !ageDistribution2023) {
          console.warn(`[SCB] Failed to fetch real data for ${desoCode}, using mock data`);
          return getMockPopulationMetrics(desoCode);
        }

        // Beräkna tillväxttakt
        let growthRate = 0;
        if (previousPopulation && previousPopulation > 0) {
          growthRate = ((currentPopulation - previousPopulation) / previousPopulation) * 100;
        }

        // Bygg historisk befolkning från åldersfördelningar
        const historicalPopulation: { year: string; population: number }[] = [];

        if (ageDistribution2019) {
          const pop2019 = Object.values(ageDistribution2019).reduce((sum, val) => sum + val, 0);
          if (pop2019 > 0) {
            historicalPopulation.push({ year: '2019', population: pop2019 });
          }
        }

        if (pop2023 > 0) {
          historicalPopulation.push({ year: '2023', population: pop2023 });
        }

        // Lägg bara till 2024 om den har data (inte 0)
        if (pop2024 > 0) {
          historicalPopulation.push({ year: '2024', population: pop2024 });
        }

        const result = {
          total: currentPopulation,
          growth_rate: growthRate,
          age_distribution: ageDistribution2023,  // Use 2023 for current display
          kommun_avg: kommunPopData ? {
            total: Object.values(kommunPopData).reduce((sum, val) => sum + val, 0),
            age_distribution: kommunPopData
          } : undefined,
          year: currentYear,  // 2024
          age_year: previousYear,  // 2023 (age distribution uses 2023 data)
          historical_population: historicalPopulation.length > 0 ? historicalPopulation : undefined,
          age_distribution_comparison: (ageDistribution2019 && ageDistribution2023) ? {
            start_year: '2019',
            end_year: '2023',
            start_distribution: ageDistribution2019,
            end_distribution: ageDistribution2023
          } : undefined
        };

        console.log(`[SCB] Returning population metrics with historical_population: ${!!result.historical_population}, age_distribution_comparison: ${!!result.age_distribution_comparison}`);

        return result;
      } catch (error) {
        console.error(`[SCB] Error fetching population metrics:`, error);
        // Fallback till mock-data vid fel
        return getMockPopulationMetrics(desoCode);
      }
    },
    86400
  );
}

/**
 * Fallback: Mock population metrics
 */
function getMockPopulationMetrics(desoCode: string): PopulationMetrics {
  const total = Math.floor(500 + Math.random() * 3000);

  // Svenska åldersfördelning baserat på typiska värden (approximation)
  const distributions = [0.05, 0.05, 0.05, 0.05, 0.06, 0.06, 0.06, 0.07, 0.07, 0.07, 0.07, 0.07, 0.06, 0.06, 0.05, 0.04, 0.06];

  return {
    total,
    growth_rate: -2 + Math.random() * 6,
    age_distribution: {
      '0-4': Math.floor(total * distributions[0]),
      '5-9': Math.floor(total * distributions[1]),
      '10-14': Math.floor(total * distributions[2]),
      '15-19': Math.floor(total * distributions[3]),
      '20-24': Math.floor(total * distributions[4]),
      '25-29': Math.floor(total * distributions[5]),
      '30-34': Math.floor(total * distributions[6]),
      '35-39': Math.floor(total * distributions[7]),
      '40-44': Math.floor(total * distributions[8]),
      '45-49': Math.floor(total * distributions[9]),
      '50-54': Math.floor(total * distributions[10]),
      '55-59': Math.floor(total * distributions[11]),
      '60-64': Math.floor(total * distributions[12]),
      '65-69': Math.floor(total * distributions[13]),
      '70-74': Math.floor(total * distributions[14]),
      '75-79': Math.floor(total * distributions[15]),
      '80+': Math.floor(total * distributions[16])
    }
  };
}

/**
 * Get education metrics for a DeSO area
 */
export async function getEducationMetrics(desoCode: string): Promise<EducationMetrics> {
  const cacheKey = generateCacheKey('scb', `education-${desoCode}`, {});

  return getCachedOrFetch(
    cacheKey,
    'scb',
    async () => {
      console.log(`[SCB] Fetching education for DeSO ${desoCode}`);

      try {
        // Hämta riktig data från SCB API
        const educationData = await getEducationDataFromSCB(desoCode);

        if (!educationData) {
          console.warn(`[SCB] Failed to fetch education data for ${desoCode}, using mock data`);
          return getMockEducationMetrics();
        }

        return {
          forgymnasial: educationData.forgymnasial,
          gymnasial: educationData.gymnasial,
          eftergymnasial: educationData.eftergymnasial,
          kommun_avg: educationData.kommun_avg || {
            forgymnasial: 20,
            gymnasial: 45,
            eftergymnasial: 35
          },
          riket_avg: educationData.riket_avg || {
            forgymnasial: 18,
            gymnasial: 43,
            eftergymnasial: 39
          },
          year: '2023'  // Education data from 2023
        };
      } catch (error) {
        console.error(`[SCB] Error fetching education metrics:`, error);
        return getMockEducationMetrics();
      }
    },
    86400
  );
}

/**
 * Fallback: Mock education metrics
 */
function getMockEducationMetrics(): EducationMetrics {
  const forgymnasial = 15 + Math.random() * 15;
  const gymnasial = 40 + Math.random() * 10;
  const eftergymnasial = 100 - forgymnasial - gymnasial;

  return {
    forgymnasial,
    gymnasial,
    eftergymnasial,
    kommun_avg: {
      forgymnasial: 20,
      gymnasial: 45,
      eftergymnasial: 35
    },
    riket_avg: {
      forgymnasial: 18,
      gymnasial: 43,
      eftergymnasial: 39
    }
  };
}

/**
 * Get migration metrics for a DeSO area
 */
export async function getMigrationMetrics(desoCode: string): Promise<MigrationMetrics> {
  const cacheKey = generateCacheKey('scb', `migration-${desoCode}`, {});

  return getCachedOrFetch(
    cacheKey,
    'scb',
    async () => {
      console.log(`[SCB] Fetching migration for DeSO ${desoCode}`);

      try {
        // Hämta riktig data från SCB API (RegSO-nivå)
        const migrationData = await getMigrationDataFromSCB(desoCode);

        if (!migrationData) {
          console.warn(`[SCB] Failed to fetch migration data for ${desoCode}, using mock data`);
          return getMockMigrationMetrics();
        }

        // SCB data är bara procent på RegSO-nivå
        // Vi returnerar bara netto baserat på riktiga procent från SCB
        // (inflyttade/utflyttade absoluta tal saknas i SCB:s publika API)

        return {
          inflyttade: 0,  // Ej tillgängligt från SCB publika API
          utflyttade: 0,  // Ej tillgängligt från SCB publika API
          netto: Math.round(migrationData.domestic_net_migration_pct * 10), // Approximation för display
          year: '2023'  // Migration data from 2023
        };
      } catch (error) {
        console.error(`[SCB] Error fetching migration metrics:`, error);
        return getMockMigrationMetrics();
      }
    },
    86400
  );
}

/**
 * Fallback: Mock migration metrics (when SCB API fails)
 */
function getMockMigrationMetrics(): MigrationMetrics {
  return {
    inflyttade: 0,
    utflyttade: 0,
    netto: 0
  };
}

/**
 * Get origin metrics (Swedish/Foreign background) for a DeSO area
 */
export async function getOriginMetrics(desoCode: string, kommunCode?: string): Promise<OriginMetrics> {
  const cacheKey = generateCacheKey('scb', `origin-${desoCode}`, {});

  return getCachedOrFetch(
    cacheKey,
    'scb',
    async () => {
      console.log(`[SCB] Fetching origin data for DeSO ${desoCode}`);

      try {
        // Hämta data från SCB API i parallell
        const [originData, kommunData] = await Promise.all([
          getOriginDataFromSCB(desoCode),
          kommunCode ? getOriginDataForKommun(kommunCode) : Promise.resolve(null)
        ]);

        if (!originData) {
          console.warn(`[SCB] Failed to fetch origin data for ${desoCode}, using mock data`);
          return getMockOriginMetrics();
        }

        return {
          swedish_background: originData.swedish_background,
          foreign_background: originData.foreign_background,
          percentage_foreign: originData.percentage_foreign,
          kommun_avg: kommunData || undefined,
          year: '2024'  // Origin data from 2024
        };
      } catch (error) {
        console.error(`[SCB] Error fetching origin metrics:`, error);
        return getMockOriginMetrics();
      }
    },
    86400 // 24h cache
  );
}

/**
 * Fallback: Mock origin metrics
 */
function getMockOriginMetrics(): OriginMetrics {
  const totalPop = 1000 + Math.random() * 2000;
  const foreignPct = 15 + Math.random() * 25; // 15-40%
  const foreignBg = Math.round(totalPop * (foreignPct / 100));
  const swedishBg = Math.round(totalPop - foreignBg);

  return {
    swedish_background: swedishBg,
    foreign_background: foreignBg,
    percentage_foreign: foreignPct
  };
}

/**
 * Get household metrics for a DeSO area
 * Note: May fall back to RegSO level if DeSO data is not available
 */
export async function getHouseholdMetrics(desoCode: string, kommunCode?: string): Promise<HouseholdMetrics> {
  const cacheKey = generateCacheKey('scb', `household-${desoCode}`, {});

  return getCachedOrFetch(
    cacheKey,
    'scb',
    async () => {
      console.log(`[SCB] Fetching household data for DeSO ${desoCode}`);

      try {
        // Hämta data i parallell
        const [householdData, kommunData] = await Promise.all([
          getHouseholdDataFromSCB(desoCode),
          kommunCode ? getHouseholdDataForKommun(kommunCode) : Promise.resolve(null)
        ]);

        if (!householdData) {
          console.warn(`[SCB] Failed to fetch household data for ${desoCode}`);
          return getMockHouseholdMetrics();
        }

        return {
          total_households: householdData.total_households,
          single_person: householdData.single_person,
          two_person: householdData.two_person,
          three_plus_person: householdData.three_plus_person,
          average_household_size: householdData.average_household_size,
          kommun_avg: kommunData || undefined,
          year: '2024'  // Household data from 2024
        };
      } catch (error) {
        console.error(`[SCB] Error fetching household metrics:`, error);
        return getMockHouseholdMetrics();
      }
    },
    86400 // 24h cache
  );
}

/**
 * Fallback: Mock household metrics
 */
function getMockHouseholdMetrics(): HouseholdMetrics {
  const totalHouseholds = Math.floor(500 + Math.random() * 1500);
  const singlePct = 0.35 + Math.random() * 0.15; // 35-50%
  const twoPct = 0.30 + Math.random() * 0.10; // 30-40%
  const threePlusPct = 1 - singlePct - twoPct;

  const single = Math.floor(totalHouseholds * singlePct);
  const two = Math.floor(totalHouseholds * twoPct);
  const threePlus = totalHouseholds - single - two;

  const avgSize = ((single * 1) + (two * 2) + (threePlus * 3.5)) / totalHouseholds;

  return {
    total_households: totalHouseholds,
    single_person: single,
    two_person: two,
    three_plus_person: threePlus,
    average_household_size: avgSize
  };
}

/**
 * Get housing type metrics for a DeSO area
 */
export async function getHousingTypeMetrics(desoCode: string, kommunCode?: string): Promise<HousingTypeMetrics> {
  const cacheKey = generateCacheKey('scb', `housingtype-${desoCode}`, {});

  return getCachedOrFetch(
    cacheKey,
    'scb',
    async () => {
      console.log(`[SCB] Fetching housing type for DeSO ${desoCode}`);

      try {
        const [housingTypeData, kommunData] = await Promise.all([
          getHousingTypeDataFromSCB(desoCode),
          kommunCode ? getHousingTypeDataForKommun(kommunCode) : Promise.resolve(null)
        ]);

        if (!housingTypeData) {
          console.warn(`[SCB] Failed to fetch housing type data for ${desoCode}, using mock data`);
          return getMockHousingTypeMetrics();
        }

        return {
          smahus: housingTypeData.smahus,
          flerbostadshus: housingTypeData.flerbostadshus,
          percentage_smahus: housingTypeData.percentage_smahus,
          kommun_avg: kommunData || undefined,
          year: '2024'  // Housing type data from 2024
        };
      } catch (error) {
        console.error(`[SCB] Error fetching housing type metrics:`, error);
        return getMockHousingTypeMetrics();
      }
    },
    86400 // 24h cache
  );
}

/**
 * Fallback: Mock housing type metrics
 */
function getMockHousingTypeMetrics(): HousingTypeMetrics {
  const total = 1000 + Math.random() * 2000;
  const smahusPct = 35 + Math.random() * 30; // 35-65%
  const smahus = Math.round(total * (smahusPct / 100));
  const flerbostadshus = Math.round(total - smahus);

  return {
    smahus,
    flerbostadshus,
    percentage_smahus: smahusPct
  };
}

/**
 * Get tenure form metrics for a DeSO area
 */
export async function getTenureFormMetrics(desoCode: string, kommunCode?: string): Promise<TenureFormMetrics> {
  const cacheKey = generateCacheKey('scb', `tenureform-${desoCode}`, {});

  return getCachedOrFetch(
    cacheKey,
    'scb',
    async () => {
      console.log(`[SCB] Fetching tenure form for DeSO ${desoCode}`);

      try {
        const [tenureFormData, kommunData] = await Promise.all([
          getTenureFormDataFromSCB(desoCode),
          kommunCode ? getTenureFormDataForKommun(kommunCode) : Promise.resolve(null)
        ]);

        if (!tenureFormData) {
          console.warn(`[SCB] Failed to fetch tenure form data for ${desoCode}, using mock data`);
          return getMockTenureFormMetrics();
        }

        return {
          aganderatt: tenureFormData.aganderatt,
          bostadsratt: tenureFormData.bostadsratt,
          hyresratt: tenureFormData.hyresratt,
          percentage_aganderatt: tenureFormData.percentage_aganderatt,
          percentage_bostadsratt: tenureFormData.percentage_bostadsratt,
          percentage_hyresratt: tenureFormData.percentage_hyresratt,
          kommun_avg: kommunData || undefined,
          year: '2024'  // Tenure form data from 2024
        };
      } catch (error) {
        console.error(`[SCB] Error fetching tenure form metrics:`, error);
        return getMockTenureFormMetrics();
      }
    },
    86400 // 24h cache
  );
}

/**
 * Fallback: Mock tenure form metrics
 */
function getMockTenureFormMetrics(): TenureFormMetrics {
  const total = 1000 + Math.random() * 2000;

  // Typical distribution in Sweden: Äganderätt ~39%, Bostadsrätt ~21%, Hyresrätt ~29%
  const aganderattPct = 30 + Math.random() * 20; // 30-50%
  const bostadsrattPct = 15 + Math.random() * 15; // 15-30%
  const hyresrattPct = 100 - aganderattPct - bostadsrattPct;

  const aganderatt = Math.round(total * (aganderattPct / 100));
  const bostadsratt = Math.round(total * (bostadsrattPct / 100));
  const hyresratt = Math.round(total - aganderatt - bostadsratt);

  return {
    aganderatt,
    bostadsratt,
    hyresratt,
    percentage_aganderatt: aganderattPct,
    percentage_bostadsratt: bostadsrattPct,
    percentage_hyresratt: hyresrattPct,
    year: '2024'  // Mock data year
  };
}

/**
 * Get economic standard metrics for a DeSO area
 */
export async function getEconomicStandardMetrics(desoCode: string, kommunCode?: string): Promise<EconomicStandardMetrics> {
  const cacheKey = generateCacheKey('scb', `economicstandard-${desoCode}`, {});

  return getCachedOrFetch(
    cacheKey,
    'scb',
    async () => {
      console.log(`[SCB] Fetching economic standard for DeSO ${desoCode}`);

      try {
        const [economicStandardData, kommunData] = await Promise.all([
          getEconomicStandardFromSCB(desoCode),
          kommunCode ? getEconomicStandardForKommun(kommunCode) : Promise.resolve(null)
        ]);

        if (!economicStandardData) {
          console.warn(`[SCB] Failed to fetch economic standard data for ${desoCode}, using mock data`);
          return getMockEconomicStandardMetrics();
        }

        return {
          ...economicStandardData,
          kommun_avg: kommunData || undefined,
          year: '2023'  // Economic standard data from 2023
        };
      } catch (error) {
        console.error(`[SCB] Error fetching economic standard metrics:`, error);
        return getMockEconomicStandardMetrics();
      }
    },
    86400 // 24h cache
  );
}

/**
 * Fallback: Mock economic standard metrics
 */
function getMockEconomicStandardMetrics(): EconomicStandardMetrics {
  const total = 500 + Math.random() * 1500;

  return {
    quartile_1: 25,
    quartile_2: 25,
    quartile_3: 25,
    quartile_4: 25,
    median_value: 250 + Math.random() * 200, // 250-450 tkr
    mean_value: 280 + Math.random() * 200,   // 280-480 tkr
    total_persons: Math.round(total),
    year: '2023'  // Mock data year
  };
}

/**
 * Get earned income metrics for a DeSO area
 */
export async function getEarnedIncomeMetrics(desoCode: string, kommunCode?: string): Promise<EarnedIncomeMetrics> {
  const cacheKey = generateCacheKey('scb', `earnedincome-${desoCode}`, {});

  return getCachedOrFetch(
    cacheKey,
    'scb',
    async () => {
      console.log(`[SCB] Fetching earned income for DeSO ${desoCode}`);

      try {
        const [earnedIncomeData, kommunData] = await Promise.all([
          getEarnedIncomeFromSCB(desoCode),
          kommunCode ? getEarnedIncomeForKommun(kommunCode) : Promise.resolve(null)
        ]);

        if (!earnedIncomeData) {
          console.warn(`[SCB] Failed to fetch earned income data for ${desoCode}, using mock data`);
          return getMockEarnedIncomeMetrics();
        }

        return {
          ...earnedIncomeData,
          kommun_avg: kommunData || undefined,
          year: '2023'  // Earned income data from 2023
        };
      } catch (error) {
        console.error(`[SCB] Error fetching earned income metrics:`, error);
        return getMockEarnedIncomeMetrics();
      }
    },
    86400 // 24h cache
  );
}

/**
 * Fallback: Mock earned income metrics
 */
function getMockEarnedIncomeMetrics(): EarnedIncomeMetrics {
  const total = 500 + Math.random() * 1500;

  return {
    quartile_1: 25,
    quartile_2: 25,
    quartile_3: 25,
    quartile_4: 25,
    median_value: 200 + Math.random() * 150, // 200-350 tkr
    mean_value: 230 + Math.random() * 150,   // 230-380 tkr
    total_persons: Math.round(total),
    year: '2023'  // Mock data year
  };
}

/**
 * Get vehicle metrics for a DeSO area
 */
export async function getVehicleMetrics(desoCode: string, kommunCode?: string, householdCount?: number): Promise<VehicleMetrics> {
  const cacheKey = generateCacheKey('scb', `vehicles-${desoCode}`, {});

  return getCachedOrFetch(
    cacheKey,
    'scb',
    async () => {
      console.log(`[SCB] Fetching vehicles for DeSO ${desoCode}`);

      try {
        const currentYear = '2024';

        // Fetch vehicle data for DeSO and kommun in parallel
        // Also fetch kommun household data if we need to calculate vehicles per household for kommun
        const fetchPromises: [
          Promise<{ total_vehicles: number; vehicles_in_traffic: number; vehicles_deregistered: number; } | null>,
          Promise<{ total_vehicles: number; vehicles_in_traffic: number; vehicles_deregistered: number; } | null>,
          Promise<any>
        ] = [
          getVehicleDataFromSCB(desoCode, currentYear),
          kommunCode ? getVehicleDataForKommun(kommunCode, currentYear) : Promise.resolve(null),
          kommunCode ? getHouseholdDataFromSCB(kommunCode, '2024') : Promise.resolve(null)
        ];

        const [vehicleData, kommunVehicleData, kommunHouseholdData] = await Promise.all(fetchPromises);

        if (!vehicleData) {
          console.warn(`[SCB] Failed to fetch vehicle data for ${desoCode}, using mock data`);
          return getMockVehicleMetrics();
        }

        // Calculate vehicles per household for DeSO if household count is provided
        let vehiclesPerHousehold: number | undefined;
        if (householdCount && householdCount > 0) {
          vehiclesPerHousehold = vehicleData.total_vehicles / householdCount;
        }

        const result: VehicleMetrics = {
          total_vehicles: vehicleData.total_vehicles,
          vehicles_in_traffic: vehicleData.vehicles_in_traffic,
          vehicles_deregistered: vehicleData.vehicles_deregistered,
          vehicles_per_household: vehiclesPerHousehold,
          year: currentYear
        };

        // Add kommun average if available
        if (kommunVehicleData) {
          // Calculate vehicles per household for kommun
          let kommunVehiclesPerHousehold: number | undefined;
          if (kommunHouseholdData && kommunHouseholdData.total_households > 0) {
            kommunVehiclesPerHousehold = kommunVehicleData.total_vehicles / kommunHouseholdData.total_households;
          }

          result.kommun_avg = {
            total_vehicles: kommunVehicleData.total_vehicles,
            vehicles_in_traffic: kommunVehicleData.vehicles_in_traffic,
            vehicles_deregistered: kommunVehicleData.vehicles_deregistered,
            vehicles_per_household: kommunVehiclesPerHousehold
          };
        }

        return result;
      } catch (error) {
        console.error(`[SCB] Error fetching vehicle metrics:`, error);
        return getMockVehicleMetrics();
      }
    },
    86400
  );
}

/**
 * Fallback: Mock vehicle metrics
 */
function getMockVehicleMetrics(): VehicleMetrics {
  const total = Math.round(800 + Math.random() * 400);
  const inTraffic = Math.round(total * 0.95);
  const deregistered = total - inTraffic;

  return {
    total_vehicles: total,
    vehicles_in_traffic: inTraffic,
    vehicles_deregistered: deregistered,
    vehicles_per_household: 1.2 + Math.random() * 0.4,  // 1.2-1.6
    year: '2023'
  };
}

/**
 * Get building age metrics for a DeSO area
 */
export async function getBuildingAgeMetrics(desoCode: string, kommunCode?: string): Promise<BuildingAgeMetrics> {
  const cacheKey = generateCacheKey('scb', `building-age-${desoCode}`, {});

  return getCachedOrFetch(
    cacheKey,
    'scb',
    async () => {
      console.log(`[SCB] Fetching building age for DeSO ${desoCode}`);

      try {
        const currentYear = '2024';

        const [buildingAgeData, kommunBuildingAgeData] = await Promise.all([
          getBuildingAgeDataFromSCB(desoCode, currentYear),
          kommunCode ? getBuildingAgeDataForKommun(kommunCode, currentYear) : Promise.resolve(null)
        ]);

        if (!buildingAgeData) {
          console.warn(`[SCB] Failed to fetch building age data for ${desoCode}`);
          return getMockBuildingAgeMetrics();
        }

        // Calculate percentages for DeSO
        const periods = buildingAgeData.periods.map(p => ({
          period: p.period,
          count: p.count,
          percentage: (p.count / buildingAgeData.total) * 100
        }));

        // Calculate average age (approximate from mid-points of periods)
        let weightedSum = 0;
        let totalCount = 0;
        const currentYear2024 = 2024;

        periods.forEach(p => {
          let midYear: number;
          if (p.period === '-1920') {
            midYear = 1900;  // Approximate
          } else if (p.period === '2021-2030') {
            midYear = 2024;  // Recent construction
          } else {
            const [start, end] = p.period.split('-').map(Number);
            midYear = (start + end) / 2;
          }
          const age = currentYear2024 - midYear;
          weightedSum += age * p.count;
          totalCount += p.count;
        });

        const averageAge = totalCount > 0 ? weightedSum / totalCount : undefined;

        const result: BuildingAgeMetrics = {
          periods,
          total_buildings: buildingAgeData.total,
          average_age: averageAge,
          year: currentYear
        };

        // Add kommun average if available
        if (kommunBuildingAgeData) {
          const kommunPeriods = kommunBuildingAgeData.periods.map(p => ({
            period: p.period,
            count: p.count,
            percentage: (p.count / kommunBuildingAgeData.total) * 100
          }));

          // Calculate kommun average age
          let kommunWeightedSum = 0;
          let kommunTotalCount = 0;

          kommunPeriods.forEach(p => {
            let midYear: number;
            if (p.period === '-1920') {
              midYear = 1900;
            } else if (p.period === '2021-2030') {
              midYear = 2024;
            } else {
              const [start, end] = p.period.split('-').map(Number);
              midYear = (start + end) / 2;
            }
            const age = currentYear2024 - midYear;
            kommunWeightedSum += age * p.count;
            kommunTotalCount += p.count;
          });

          const kommunAverageAge = kommunTotalCount > 0 ? kommunWeightedSum / kommunTotalCount : undefined;

          result.kommun_avg = {
            periods: kommunPeriods,
            total_buildings: kommunBuildingAgeData.total,
            average_age: kommunAverageAge
          };
        }

        return result;
      } catch (error) {
        console.error(`[SCB] Error fetching building age metrics:`, error);
        return getMockBuildingAgeMetrics();
      }
    },
    86400
  );
}

/**
 * Fallback: Mock building age metrics
 */
function getMockBuildingAgeMetrics(): BuildingAgeMetrics {
  const mockPeriods = [
    { period: '-1920', count: 5, percentage: 2.5 },
    { period: '1921-1930', count: 8, percentage: 4.0 },
    { period: '1931-1940', count: 12, percentage: 6.0 },
    { period: '1941-1950', count: 15, percentage: 7.5 },
    { period: '1951-1960', count: 45, percentage: 22.5 },
    { period: '1961-1970', count: 40, percentage: 20.0 },
    { period: '1971-1980', count: 30, percentage: 15.0 },
    { period: '1981-1990', count: 20, percentage: 10.0 },
    { period: '1991-2000', count: 15, percentage: 7.5 },
    { period: '2001-2010', count: 8, percentage: 4.0 },
    { period: '2011-2020', count: 2, percentage: 1.0 }
  ];

  return {
    periods: mockPeriods,
    total_buildings: 200,
    average_age: 52,
    year: '2024'
  };
}

/**
 * Get time series data for a specific metric
 */
export async function getTimeSeries(
  desoCode: string,
  metricType: 'income' | 'population' | 'education'
): Promise<SCBTimeSeries> {
  const cacheKey = generateCacheKey('scb', `timeseries-${desoCode}-${metricType}`, {});

  return getCachedOrFetch(
    cacheKey,
    'scb',
    async () => {
      return await queueSCBRequest(`timeseries-${desoCode}-${metricType}`, async () => {
        console.log(`[SCB] Fetching time series for DeSO ${desoCode}, metric: ${metricType}`);

        // Mock time series for MVP (last 12 months)
        const data = [];
        const now = new Date();

        for (let i = 11; i >= 0; i--) {
          const date = new Date(now);
          date.setMonth(date.getMonth() - i);

          let value: number;

          switch (metricType) {
            case 'income':
              value = 320000 + (i * 1000) + (Math.random() * 5000);
              break;
            case 'population':
              value = 1500 + (i * 5) + (Math.random() * 50);
              break;
            case 'education':
              value = 35 + (Math.random() * 5);
              break;
            default:
              value = 0;
          }

          data.push({
            date: date.toISOString().split('T')[0],
            value: Math.round(value)
          });
        }

        return {
          metric_type: metricType,
          metric_name: metricType === 'income' ? 'Medianinkomst' :
                       metricType === 'population' ? 'Befolkning' :
                       'Eftergymnasial utbildning (%)',
          unit: metricType === 'income' ? 'SEK' :
                metricType === 'population' ? 'antal' : '%',
          data
        };
      });
    },
    3600 // 1h cache for time series
  );
}

/**
 * Get all metrics for a DeSO area (convenience method)
 */
export async function getAllMetrics(desoCode: string, kommunCode?: string) {
  try {
    const [income, population, education, migration, origin, household, housing_type, tenure_form, economic_standard, earned_income, building_age] = await Promise.all([
      getIncomeMetrics(desoCode),
      getPopulationMetrics(desoCode, kommunCode),
      getEducationMetrics(desoCode),
      getMigrationMetrics(desoCode),
      getOriginMetrics(desoCode, kommunCode),
      getHouseholdMetrics(desoCode, kommunCode),
      getHousingTypeMetrics(desoCode, kommunCode),
      getTenureFormMetrics(desoCode, kommunCode),
      getEconomicStandardMetrics(desoCode, kommunCode),
      getEarnedIncomeMetrics(desoCode, kommunCode),
      getBuildingAgeMetrics(desoCode, kommunCode)
    ]);

    // Fetch vehicles after household to use household count for per-household calculation
    const vehicles = await getVehicleMetrics(desoCode, kommunCode, household.total_households);

    return {
      income,
      population,
      education,
      migration,
      origin,
      household,
      housing_type,
      tenure_form,
      economic_standard,
      earned_income,
      vehicles,
      building_age
    };
  } catch (error: any) {
    console.error(`[SCB] Error getting all metrics for ${desoCode}:`, error);
    throw new Error(`Failed to fetch metrics: ${error.message}`);
  }
}

/**
 * Get kommun-level aggregated metrics
 */
export async function getKommunMetrics(kommunCode: string) {
  const cacheKey = generateCacheKey('scb', `kommun-${kommunCode}`, {});

  return getCachedOrFetch(
    cacheKey,
    'scb',
    async () => {
      console.log(`[SCB] Fetching kommun metrics for ${kommunCode}`);

      // Mock kommun-level data
      return {
        kommun_code: kommunCode,
        population: 50000 + Math.floor(Math.random() * 100000),
        median_income: 310000,
        education_eftergymnasial: 35
      };
    },
    86400
  );
}

/**
 * Get riket (Sweden) level metrics for comparison
 */
export async function getRiketMetrics() {
  const cacheKey = generateCacheKey('scb', 'riket', {});

  return getCachedOrFetch(
    cacheKey,
    'scb',
    async () => {
      console.log('[SCB] Fetching riket metrics');

      // Static Sverige-wide averages
      return {
        population: 10500000,
        median_income: 325000,
        education_eftergymnasial: 39
      };
    },
    604800 // 7 days cache (very stable data)
  );
}

/**
 * Get aggregated metrics for multiple DeSO areas
 * Weighted by population for most metrics
 */
export async function getAggregatedMetrics(desoCodes: string[]) {
  try {
    console.log(`[SCB] Fetching aggregated metrics for ${desoCodes.length} DeSO areas`);

    if (desoCodes.length === 0) {
      throw new Error('No DeSO codes provided');
    }

    // If only one DeSO, return normal metrics with kommun comparison
    if (desoCodes.length === 1) {
      // Get kommun_code for the DeSO area
      const { getDeSoDetails } = await import('./geo.service');
      const desoDetails = await getDeSoDetails([desoCodes[0]]);
      const kommunCode = desoDetails.length > 0 ? desoDetails[0].kommun_code : undefined;

      return {
        deso_codes: desoCodes,
        area_count: 1,
        metrics: await getAllMetrics(desoCodes[0], kommunCode)
      };
    }

    // Fetch metrics for all DeSO areas in parallel
    const allMetrics = await Promise.all(
      desoCodes.map(async (code) => {
        try {
          return {
            deso_code: code,
            metrics: await getAllMetrics(code)
          };
        } catch (error) {
          console.error(`[SCB] Failed to fetch metrics for ${code}:`, error);
          return null;
        }
      })
    );

    // Filter out failed requests
    const validMetrics = allMetrics.filter(m => m !== null);

    if (validMetrics.length === 0) {
      throw new Error('Failed to fetch metrics for all areas');
    }

    // Determine majority kommun for comparison
    const { getDeSoDetails } = await import('./geo.service');
    const allDesoDetails = await getDeSoDetails(desoCodes);

    // Count kommun occurrences
    const kommunCounts = new Map<string, number>();
    allDesoDetails.forEach(deso => {
      if (deso.kommun_code) {
        kommunCounts.set(deso.kommun_code, (kommunCounts.get(deso.kommun_code) || 0) + 1);
      }
    });

    // Find kommun with most DeSO areas
    let majorityKommun: string | undefined;
    let maxCount = 0;
    kommunCounts.forEach((count, kommun) => {
      if (count > maxCount) {
        maxCount = count;
        majorityKommun = kommun;
      }
    });

    console.log(`[SCB] Majority kommun for aggregation: ${majorityKommun} (${maxCount}/${desoCodes.length} areas)`);

    // Fetch kommun comparison data if majority kommun exists
    let kommunEconomicStandard = null;
    let kommunEarnedIncome = null;
    let kommunOrigin = null;
    let kommunPopulation = null;
    let kommunHousehold = null;
    let kommunHousingType = null;
    let kommunTenureForm = null;
    let kommunVehicles = null;
    let kommunBuildingAge = null;

    if (majorityKommun) {
      try {
        [
          kommunEconomicStandard,
          kommunEarnedIncome,
          kommunOrigin,
          kommunPopulation,
          kommunHousehold,
          kommunHousingType,
          kommunTenureForm,
          kommunVehicles,
          kommunBuildingAge
        ] = await Promise.all([
          getEconomicStandardForKommun(majorityKommun),
          getEarnedIncomeForKommun(majorityKommun),
          getOriginDataForKommun(majorityKommun),
          getPopulationDataForKommun(majorityKommun),
          getHouseholdDataForKommun(majorityKommun),
          getHousingTypeDataForKommun(majorityKommun),
          getTenureFormDataForKommun(majorityKommun),
          getVehicleDataForKommun(majorityKommun),
          getBuildingAgeDataForKommun(majorityKommun)
        ]);
      } catch (error) {
        console.error('[SCB] Failed to fetch kommun comparison data:', error);
      }
    }

    // Calculate total population for weighting
    const totalPopulation = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.population.total || 0),
      0
    );

    if (totalPopulation === 0) {
      throw new Error('Total population is zero, cannot aggregate');
    }

    // Aggregate income (population-weighted)
    const weightedMedianIncome = validMetrics.reduce((sum, m) => {
      const pop = m!.metrics.population.total || 0;
      const income = m!.metrics.income.median_income || 0;
      return sum + (income * pop);
    }, 0) / totalPopulation;

    const weightedMeanIncome = validMetrics.reduce((sum, m) => {
      const pop = m!.metrics.population.total || 0;
      const income = m!.metrics.income.mean_income || 0;
      return sum + (income * pop);
    }, 0) / totalPopulation;

    // Aggregate education (population-weighted percentages)
    const weightedForgymnasial = validMetrics.reduce((sum, m) => {
      const pop = m!.metrics.population.total || 0;
      const edu = m!.metrics.education.forgymnasial || 0;
      return sum + (edu * pop);
    }, 0) / totalPopulation;

    const weightedGymnasial = validMetrics.reduce((sum, m) => {
      const pop = m!.metrics.population.total || 0;
      const edu = m!.metrics.education.gymnasial || 0;
      return sum + (edu * pop);
    }, 0) / totalPopulation;

    const weightedEftergymnasial = validMetrics.reduce((sum, m) => {
      const pop = m!.metrics.population.total || 0;
      const edu = m!.metrics.education.eftergymnasial || 0;
      return sum + (edu * pop);
    }, 0) / totalPopulation;

    // Aggregate migration (sum absolute numbers)
    const totalInflyttade = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.migration.inflyttade || 0),
      0
    );

    const totalUtflyttade = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.migration.utflyttade || 0),
      0
    );

    // Calculate age distribution (sum absolute numbers for all 17 groups)
    const ageSum = {
      '0-4': 0, '5-9': 0, '10-14': 0, '15-19': 0, '20-24': 0, '25-29': 0,
      '30-34': 0, '35-39': 0, '40-44': 0, '45-49': 0, '50-54': 0, '55-59': 0,
      '60-64': 0, '65-69': 0, '70-74': 0, '75-79': 0, '80+': 0
    };

    validMetrics.forEach(m => {
      const dist = m!.metrics.population.age_distribution;
      if (dist) {
        ageSum['0-4'] += dist['0-4'] || 0;
        ageSum['5-9'] += dist['5-9'] || 0;
        ageSum['10-14'] += dist['10-14'] || 0;
        ageSum['15-19'] += dist['15-19'] || 0;
        ageSum['20-24'] += dist['20-24'] || 0;
        ageSum['25-29'] += dist['25-29'] || 0;
        ageSum['30-34'] += dist['30-34'] || 0;
        ageSum['35-39'] += dist['35-39'] || 0;
        ageSum['40-44'] += dist['40-44'] || 0;
        ageSum['45-49'] += dist['45-49'] || 0;
        ageSum['50-54'] += dist['50-54'] || 0;
        ageSum['55-59'] += dist['55-59'] || 0;
        ageSum['60-64'] += dist['60-64'] || 0;
        ageSum['65-69'] += dist['65-69'] || 0;
        ageSum['70-74'] += dist['70-74'] || 0;
        ageSum['75-79'] += dist['75-79'] || 0;
        ageSum['80+'] += dist['80+'] || 0;
      }
    });

    // Calculate average growth rate (simple average, not weighted)
    const avgGrowthRate = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.population.growth_rate || 0),
      0
    ) / validMetrics.length;

    // Aggregate historical population (sum for each year)
    const historicalPopulationMap = new Map<string, number>();
    validMetrics.forEach(m => {
      const histPop = m!.metrics.population.historical_population;
      if (histPop && Array.isArray(histPop)) {
        histPop.forEach(point => {
          const currentTotal = historicalPopulationMap.get(point.year) || 0;
          historicalPopulationMap.set(point.year, currentTotal + point.population);
        });
      }
    });

    // Convert map to sorted array
    const aggregatedHistoricalPopulation = Array.from(historicalPopulationMap.entries())
      .map(([year, population]) => ({ year, population }))
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));

    // Aggregate age distribution comparison (sum for both start and end distributions)
    let aggregatedAgeComparison = undefined;
    const firstComparison = validMetrics.find(m => m!.metrics.population.age_distribution_comparison)?.metrics.population.age_distribution_comparison;

    if (firstComparison) {
      const startAgeSum = {
        '0-4': 0, '5-9': 0, '10-14': 0, '15-19': 0, '20-24': 0, '25-29': 0,
        '30-34': 0, '35-39': 0, '40-44': 0, '45-49': 0, '50-54': 0, '55-59': 0,
        '60-64': 0, '65-69': 0, '70-74': 0, '75-79': 0, '80+': 0
      };
      const endAgeSum = {
        '0-4': 0, '5-9': 0, '10-14': 0, '15-19': 0, '20-24': 0, '25-29': 0,
        '30-34': 0, '35-39': 0, '40-44': 0, '45-49': 0, '50-54': 0, '55-59': 0,
        '60-64': 0, '65-69': 0, '70-74': 0, '75-79': 0, '80+': 0
      };

      validMetrics.forEach(m => {
        const comp = m!.metrics.population.age_distribution_comparison;
        if (comp) {
          Object.keys(startAgeSum).forEach(ageGroup => {
            startAgeSum[ageGroup as keyof typeof startAgeSum] += comp.start_distribution[ageGroup as keyof typeof comp.start_distribution] || 0;
            endAgeSum[ageGroup as keyof typeof endAgeSum] += comp.end_distribution[ageGroup as keyof typeof comp.end_distribution] || 0;
          });
        }
      });

      aggregatedAgeComparison = {
        start_year: firstComparison.start_year,
        end_year: firstComparison.end_year,
        start_distribution: startAgeSum,
        end_distribution: endAgeSum
      };
    }

    // Aggregate origin metrics (sum absolute numbers)
    const totalSwedishBackground = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.origin?.swedish_background || 0),
      0
    );

    const totalForeignBackground = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.origin?.foreign_background || 0),
      0
    );

    const totalOriginPopulation = totalSwedishBackground + totalForeignBackground;
    const aggregatedForeignPct = totalOriginPopulation > 0
      ? (totalForeignBackground / totalOriginPopulation) * 100
      : 0;

    // Aggregate household metrics (sum counts, recalculate average)
    const totalHouseholds = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.household?.total_households || 0),
      0
    );

    const totalSinglePerson = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.household?.single_person || 0),
      0
    );

    const totalTwoPerson = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.household?.two_person || 0),
      0
    );

    const totalThreePlusPerson = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.household?.three_plus_person || 0),
      0
    );

    const aggregatedAvgHouseholdSize = totalHouseholds > 0
      ? ((totalSinglePerson * 1) + (totalTwoPerson * 2) + (totalThreePlusPerson * 3.5)) / totalHouseholds
      : 0;

    // Aggregate housing type metrics (sum counts, recalculate percentage)
    const totalSmahus = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.housing_type?.smahus || 0),
      0
    );

    const totalFlerbostadshus = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.housing_type?.flerbostadshus || 0),
      0
    );

    const totalHousingTypePopulation = totalSmahus + totalFlerbostadshus;
    const aggregatedSmahusPct = totalHousingTypePopulation > 0
      ? (totalSmahus / totalHousingTypePopulation) * 100
      : 0;

    // Aggregate tenure form metrics (sum counts, recalculate percentages)
    const totalAganderatt = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.tenure_form?.aganderatt || 0),
      0
    );

    const totalBostadsratt = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.tenure_form?.bostadsratt || 0),
      0
    );

    const totalHyresratt = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.tenure_form?.hyresratt || 0),
      0
    );

    const totalTenureFormPopulation = totalAganderatt + totalBostadsratt + totalHyresratt;
    const aggregatedAganderattPct = totalTenureFormPopulation > 0
      ? (totalAganderatt / totalTenureFormPopulation) * 100
      : 0;
    const aggregatedBostadsrattPct = totalTenureFormPopulation > 0
      ? (totalBostadsratt / totalTenureFormPopulation) * 100
      : 0;
    const aggregatedHyresrattPct = totalTenureFormPopulation > 0
      ? (totalHyresratt / totalTenureFormPopulation) * 100
      : 0;

    // Aggregate economic standard metrics (weighted by total_persons)
    const totalEconomicStandardPersons = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.economic_standard?.total_persons || 0),
      0
    );

    const weightedEconomicStandard = {
      quartile_1: validMetrics.reduce((sum, m) => {
        const weight = (m!.metrics.economic_standard?.total_persons || 0) / totalEconomicStandardPersons;
        return sum + (m!.metrics.economic_standard?.quartile_1 || 0) * weight;
      }, 0),
      quartile_2: validMetrics.reduce((sum, m) => {
        const weight = (m!.metrics.economic_standard?.total_persons || 0) / totalEconomicStandardPersons;
        return sum + (m!.metrics.economic_standard?.quartile_2 || 0) * weight;
      }, 0),
      quartile_3: validMetrics.reduce((sum, m) => {
        const weight = (m!.metrics.economic_standard?.total_persons || 0) / totalEconomicStandardPersons;
        return sum + (m!.metrics.economic_standard?.quartile_3 || 0) * weight;
      }, 0),
      quartile_4: validMetrics.reduce((sum, m) => {
        const weight = (m!.metrics.economic_standard?.total_persons || 0) / totalEconomicStandardPersons;
        return sum + (m!.metrics.economic_standard?.quartile_4 || 0) * weight;
      }, 0),
      median_value: validMetrics.reduce((sum, m) => {
        const weight = (m!.metrics.economic_standard?.total_persons || 0) / totalEconomicStandardPersons;
        return sum + (m!.metrics.economic_standard?.median_value || 0) * weight;
      }, 0),
      mean_value: validMetrics.reduce((sum, m) => {
        const weight = (m!.metrics.economic_standard?.total_persons || 0) / totalEconomicStandardPersons;
        return sum + (m!.metrics.economic_standard?.mean_value || 0) * weight;
      }, 0),
      total_persons: totalEconomicStandardPersons
    };

    // Aggregate earned income metrics (weighted by total_persons)
    const totalEarnedIncomePersons = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.earned_income?.total_persons || 0),
      0
    );

    const weightedEarnedIncome = {
      quartile_1: validMetrics.reduce((sum, m) => {
        const weight = (m!.metrics.earned_income?.total_persons || 0) / totalEarnedIncomePersons;
        return sum + (m!.metrics.earned_income?.quartile_1 || 0) * weight;
      }, 0),
      quartile_2: validMetrics.reduce((sum, m) => {
        const weight = (m!.metrics.earned_income?.total_persons || 0) / totalEarnedIncomePersons;
        return sum + (m!.metrics.earned_income?.quartile_2 || 0) * weight;
      }, 0),
      quartile_3: validMetrics.reduce((sum, m) => {
        const weight = (m!.metrics.earned_income?.total_persons || 0) / totalEarnedIncomePersons;
        return sum + (m!.metrics.earned_income?.quartile_3 || 0) * weight;
      }, 0),
      quartile_4: validMetrics.reduce((sum, m) => {
        const weight = (m!.metrics.earned_income?.total_persons || 0) / totalEarnedIncomePersons;
        return sum + (m!.metrics.earned_income?.quartile_4 || 0) * weight;
      }, 0),
      median_value: validMetrics.reduce((sum, m) => {
        const weight = (m!.metrics.earned_income?.total_persons || 0) / totalEarnedIncomePersons;
        return sum + (m!.metrics.earned_income?.median_value || 0) * weight;
      }, 0),
      mean_value: validMetrics.reduce((sum, m) => {
        const weight = (m!.metrics.earned_income?.total_persons || 0) / totalEarnedIncomePersons;
        return sum + (m!.metrics.earned_income?.mean_value || 0) * weight;
      }, 0),
      total_persons: totalEarnedIncomePersons
    };

    // Aggregate vehicle metrics (simple summation)
    const totalVehicles = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.vehicles?.total_vehicles || 0),
      0
    );
    const totalVehiclesInTraffic = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.vehicles?.vehicles_in_traffic || 0),
      0
    );
    const totalVehiclesDeregistered = validMetrics.reduce(
      (sum, m) => sum + (m!.metrics.vehicles?.vehicles_deregistered || 0),
      0
    );

    // Calculate vehicles per household for aggregated area
    const vehiclesPerHousehold = totalHouseholds > 0
      ? totalVehicles / totalHouseholds
      : undefined;

    // Aggregate building age data (sum counts per period)
    const buildingAgePeriodMap = new Map<string, number>();

    validMetrics.forEach(m => {
      const periods = m!.metrics.building_age?.periods || [];
      periods.forEach(p => {
        const currentCount = buildingAgePeriodMap.get(p.period) || 0;
        buildingAgePeriodMap.set(p.period, currentCount + p.count);
      });
    });

    const totalBuildings = Array.from(buildingAgePeriodMap.values()).reduce((sum, count) => sum + count, 0);

    const aggregatedBuildingAgePeriods = Array.from(buildingAgePeriodMap.entries())
      .map(([period, count]) => ({
        period,
        count,
        percentage: totalBuildings > 0 ? (count / totalBuildings) * 100 : 0
      }))
      .sort((a, b) => {
        // Sort chronologically
        const periodOrder = ['-1920', '1921-1930', '1931-1940', '1941-1950', '1951-1960',
                            '1961-1970', '1971-1980', '1981-1990', '1991-2000', '2001-2010',
                            '2011-2020', '2021-2030'];
        return periodOrder.indexOf(a.period) - periodOrder.indexOf(b.period);
      });

    // Calculate average age for aggregated area
    let buildingAgeWeightedSum = 0;
    const currentYear2024 = 2024;

    aggregatedBuildingAgePeriods.forEach(p => {
      let midYear: number;
      if (p.period === '-1920') {
        midYear = 1900;
      } else if (p.period === '2021-2030') {
        midYear = 2024;
      } else {
        const [start, end] = p.period.split('-').map(Number);
        midYear = (start + end) / 2;
      }
      const age = currentYear2024 - midYear;
      buildingAgeWeightedSum += age * p.count;
    });

    const averageBuildingAge = totalBuildings > 0 ? buildingAgeWeightedSum / totalBuildings : undefined;

    // Process kommun building age if available
    let kommunBuildingAgeData = undefined;
    if (kommunBuildingAge) {
      const kommunTotal = kommunBuildingAge.total;
      const kommunPeriods = kommunBuildingAge.periods.map(p => ({
        period: p.period,
        count: p.count,
        percentage: kommunTotal > 0 ? (p.count / kommunTotal) * 100 : 0
      }));

      // Calculate kommun average age
      let kommunWeightedSum = 0;
      kommunPeriods.forEach(p => {
        let midYear: number;
        if (p.period === '-1920') {
          midYear = 1900;
        } else if (p.period === '2021-2030') {
          midYear = 2024;
        } else {
          const [start, end] = p.period.split('-').map(Number);
          midYear = (start + end) / 2;
        }
        const age = currentYear2024 - midYear;
        kommunWeightedSum += age * p.count;
      });

      const kommunAvgAge = kommunTotal > 0 ? kommunWeightedSum / kommunTotal : undefined;

      kommunBuildingAgeData = {
        periods: kommunPeriods,
        total_buildings: kommunTotal,
        average_age: kommunAvgAge
      };
    }

    // Get first valid kommun info (assume all in same kommun, or use most common)
    const firstMetrics = validMetrics[0]!.metrics;

    return {
      deso_codes: desoCodes,
      area_count: validMetrics.length,
      aggregation_type: 'population_weighted',
      metrics: {
        income: {
          median_income: Math.round(weightedMedianIncome),
          mean_income: Math.round(weightedMeanIncome),
          kommun_median: firstMetrics.income.kommun_median,
          riket_median: firstMetrics.income.riket_median,
          percentile_20: Math.round(weightedMedianIncome * 0.75),
          percentile_80: Math.round(weightedMedianIncome * 1.4)
        },
        population: {
          total: totalPopulation,
          growth_rate: avgGrowthRate,
          age_distribution: ageSum,
          kommun_avg: kommunPopulation ? {
            total: Object.values(kommunPopulation).reduce((sum, val) => sum + val, 0),
            age_distribution: kommunPopulation
          } : undefined,
          historical_population: aggregatedHistoricalPopulation.length > 0 ? aggregatedHistoricalPopulation : undefined,
          age_distribution_comparison: aggregatedAgeComparison
        },
        education: {
          forgymnasial: weightedForgymnasial,
          gymnasial: weightedGymnasial,
          eftergymnasial: weightedEftergymnasial,
          kommun_avg: firstMetrics.education.kommun_avg,
          riket_avg: firstMetrics.education.riket_avg
        },
        migration: {
          inflyttade: totalInflyttade,
          utflyttade: totalUtflyttade,
          netto: totalInflyttade - totalUtflyttade
          // origins/destinations removed - not available in SCB public API
        },
        origin: {
          swedish_background: totalSwedishBackground,
          foreign_background: totalForeignBackground,
          percentage_foreign: aggregatedForeignPct,
          kommun_avg: kommunOrigin || undefined
        },
        household: {
          total_households: totalHouseholds,
          single_person: totalSinglePerson,
          two_person: totalTwoPerson,
          three_plus_person: totalThreePlusPerson,
          average_household_size: aggregatedAvgHouseholdSize,
          kommun_avg: kommunHousehold || undefined
        },
        housing_type: {
          smahus: totalSmahus,
          flerbostadshus: totalFlerbostadshus,
          percentage_smahus: aggregatedSmahusPct,
          kommun_avg: kommunHousingType || undefined
        },
        tenure_form: {
          aganderatt: totalAganderatt,
          bostadsratt: totalBostadsratt,
          hyresratt: totalHyresratt,
          percentage_aganderatt: aggregatedAganderattPct,
          percentage_bostadsratt: aggregatedBostadsrattPct,
          percentage_hyresratt: aggregatedHyresrattPct,
          kommun_avg: kommunTenureForm || undefined
        },
        economic_standard: {
          ...weightedEconomicStandard,
          kommun_avg: kommunEconomicStandard || undefined
        },
        earned_income: {
          ...weightedEarnedIncome,
          kommun_avg: kommunEarnedIncome || undefined
        },
        vehicles: {
          total_vehicles: totalVehicles,
          vehicles_in_traffic: totalVehiclesInTraffic,
          vehicles_deregistered: totalVehiclesDeregistered,
          vehicles_per_household: vehiclesPerHousehold,
          kommun_avg: kommunVehicles || undefined
        },
        building_age: {
          periods: aggregatedBuildingAgePeriods,
          total_buildings: totalBuildings,
          average_age: averageBuildingAge,
          kommun_avg: kommunBuildingAgeData,
          year: '2024'
        }
      }
    };
  } catch (error: any) {
    console.error(`[SCB] Error getting aggregated metrics:`, error);
    throw new Error(`Failed to fetch aggregated metrics: ${error.message}`);
  }
}

export default {
  getIncomeMetrics,
  getPopulationMetrics,
  getEducationMetrics,
  getMigrationMetrics,
  getOriginMetrics,
  getHouseholdMetrics,
  getTimeSeries,
  getAllMetrics,
  getAggregatedMetrics,
  getKommunMetrics,
  getRiketMetrics
};
