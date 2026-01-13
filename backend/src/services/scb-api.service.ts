import axios from 'axios';
import { queueSCBRequest } from '../utils/rate-limiter';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SCB PxWebAPI 2.0 Integration
 *
 * Base URL: https://statistikdatabasen.scb.se/api/v2/
 * Rate Limits: Max 30 calls per 10 seconds, Max 150,000 data cells per request
 */

const SCB_API_BASE = 'https://statistikdatabasen.scb.se/api/v2';
const SCB_API_V1_BASE = 'https://api.scb.se/OV0104/v1/doris/sv/ssd';

/**
 * Interface för JSON-Stat2 response från SCB
 */
interface JSONStat2Response {
  version: string;
  class: string;
  label: string;
  source: string;
  updated: string;
  id: string[];
  size: number[];
  dimension: {
    [key: string]: {
      label: string;
      category: {
        index: {
          [key: string]: number;
        };
        label?: {
          [key: string]: string;
        };
      };
    };
  };
  value: number[];
}

/**
 * Query-builder för SCB API v2
 */
interface SCBQuery {
  selection: {
    variableCode: string;
    valueCodes: string[];
    codelist?: string;
  }[];
  placement?: {
    heading?: string[];
    stub?: string[];
  };
}

/**
 * Interface för gamla API:et (PX-Web v1)
 */
interface SCBV1Query {
  query: {
    code: string;
    selection: {
      filter: string;
      values: string[];
    };
  }[];
  response: {
    format: string;
  };
}

interface SCBV1Response {
  columns: Array<{
    code: string;
    text: string;
    type: string;
  }>;
  data: Array<{
    key: string[];
    values: string[];
  }>;
}

/**
 * Hämta åldersfördelning för ett DeSO-område från FolkmDesoAldKon (gamla API v1)
 * Returnerar 17 åldersgrupper på 5-års intervaller
 */
export async function getAgeDistributionFromSCB(desoCode: string, year: string = '2023'): Promise<{
  '0-4': number;
  '5-9': number;
  '10-14': number;
  '15-19': number;
  '20-24': number;
  '25-29': number;
  '30-34': number;
  '35-39': number;
  '40-44': number;
  '45-49': number;
  '50-54': number;
  '55-59': number;
  '60-64': number;
  '65-69': number;
  '70-74': number;
  '75-79': number;
  '80+': number;
} | null> {
  return await queueSCBRequest(`age-${desoCode}-${year}`, async () => {
    const url = `${SCB_API_V1_BASE}/START/BE/BE0101/BE0101Y/FolkmDesoAldKon`;

    // Alla 17 åldersgrupper
    const ageGroups = ['-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39',
                       '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80-'];

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [desoCode]
          }
        },
        {
          code: "Alder",
          selection: {
            filter: "item",
            values: ageGroups
          }
        },
        {
          code: "Kon",
          selection: {
            filter: "item",
            values: ["1+2"] // Båda könen
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [year]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      console.log(`[SCB API v1] Fetching age distribution for DeSO ${desoCode} (year: ${year})`);

      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data.data;

      if (!data || data.length === 0) {
        console.error('[SCB API v1] No age distribution data found');
        return null;
      }

      // Mappa age group codes till våra property names
      const ageGroupMapping: { [key: string]: string } = {
        '-4': '0-4',
        '5-9': '5-9',
        '10-14': '10-14',
        '15-19': '15-19',
        '20-24': '20-24',
        '25-29': '25-29',
        '30-34': '30-34',
        '35-39': '35-39',
        '40-44': '40-44',
        '45-49': '45-49',
        '50-54': '50-54',
        '55-59': '55-59',
        '60-64': '60-64',
        '65-69': '65-69',
        '70-74': '70-74',
        '75-79': '75-79',
        '80-': '80+'
      };

      // Initiera med 0
      const ageDistribution: any = {
        '0-4': 0, '5-9': 0, '10-14': 0, '15-19': 0, '20-24': 0, '25-29': 0,
        '30-34': 0, '35-39': 0, '40-44': 0, '45-49': 0, '50-54': 0, '55-59': 0,
        '60-64': 0, '65-69': 0, '70-74': 0, '75-79': 0, '80+': 0
      };

      // Parse data
      for (const entry of data) {
        const ageGroupCode = entry.key[1]; // Andra värdet är åldersgrupp
        const value = entry.values[0];

        // Skip ".." (konfidentiell data)
        if (value === '..') {
          continue;
        }

        const mappedKey = ageGroupMapping[ageGroupCode];
        if (mappedKey) {
          ageDistribution[mappedKey] = parseInt(value, 10) || 0;
        }
      }

      console.log(`[SCB API v1] Age distribution fetched for ${desoCode}:`, ageDistribution);

      return ageDistribution;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error(`[SCB API v1] DeSO code not found: ${desoCode}`);
      } else if (error.response) {
        console.error(`[SCB API v1] HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[SCB API v1] Error:`, error.message);
      }

      return null;
    }
  });
}

/**
 * Hämta total befolkning för ett DeSO-område från FolkmangdNy (API v1)
 * Fungerar för historiska år 2019-2024
 */
export async function getTotalPopulationFromSCB(desoCode: string, year: string = '2024'): Promise<number | null> {
  return await queueSCBRequest(`population-${desoCode}-${year}`, async () => {
    // Använd API v1 FolkmangdNy för historiska år (fungerar för 2019-2024)
    const tableId = 'FolkmangdNy';
    const baseUrl = 'https://api.scb.se/OV0104/v1/doris/sv/ssd';
    const url = `${baseUrl}/START/BE/BE0101/BE0101Y/${tableId}`;

    const desoCodeWithSuffix = `${desoCode}_DeSO2025`;

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [desoCodeWithSuffix]
          }
        },
        {
          code: "Alder",
          selection: {
            filter: "item",
            values: ["tot"] // Totalt alla åldrar
          }
        },
        {
          code: "Kon",
          selection: {
            filter: "item",
            values: ["1+2"] // Totalt (män + kvinnor)
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [year]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      console.log(`[SCB API v1] Fetching total population for DeSO ${desoCode} (year: ${year})`);

      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (!response.data.data || response.data.data.length === 0) {
        console.error('[SCB API v1] No population data in response');
        return null;
      }

      const population = parseInt(response.data.data[0].values[0], 10);

      if (isNaN(population)) {
        console.error('[SCB API v1] Population data is not a number');
        return null;
      }

      console.log(`[SCB API v1] Population for ${desoCode} (${year}): ${population}`);
      return population;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error(`[SCB API v1] DeSO code not found: ${desoCode}`);
      } else if (error.response) {
        console.error(`[SCB API v1] HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[SCB API v1] Error:`, error.message);
      }

      return null;
    }
  });
}

/**
 * Hämta historisk befolkningsdata för ett DeSO-område (2019-2024)
 * Returnerar ett år per datapunkt
 */
export async function getHistoricalPopulationFromSCB(
  desoCode: string,
  years: string[] = ['2019', '2020', '2021', '2022', '2023', '2024']
): Promise<{ year: string; population: number }[]> {
  const results: { year: string; population: number }[] = [];

  // Hämta data för varje år parallellt
  const promises = years.map(async (year) => {
    const population = await getTotalPopulationFromSCB(desoCode, year);
    if (population !== null) {
      return { year, population };
    }
    return null;
  });

  const settled = await Promise.all(promises);

  // Filtrera bort null-värden och sortera efter år
  for (const result of settled) {
    if (result !== null) {
      results.push(result);
    }
  }

  results.sort((a, b) => parseInt(a.year) - parseInt(b.year));

  return results;
}

/**
 * Intern helper: Hämta inkomst-data för en kommun från TAB1507 (utan queue)
 */
async function fetchIncomeForKommun(kommunCode: string, year: string): Promise<{
  median: number;
  mean: number;
} | null> {
  const tableId = 'TAB1507';
  const url = `${SCB_API_BASE}/tables/${tableId}/data?outputFormat=json-stat2`;

  const query: SCBQuery = {
    selection: [
      {
        variableCode: "Region",
        valueCodes: [kommunCode]
      },
      {
        variableCode: "ContentsCode",
        valueCodes: ["000006T9", "000006T8"] // Median och medel
      },
      {
        variableCode: "Tid",
        valueCodes: [year]
      }
    ]
  };

  try {
    console.log(`[SCB API] Fetching income data for kommun ${kommunCode} (year: ${year})`);

    const response = await axios.post<JSONStat2Response>(url, query, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const values = response.data.value;

    if (!values || values.length < 2) {
      console.error('[SCB API] Insufficient income data for kommun');
      return null;
    }

    // Första värdet är median, andra är medel (i tusental kronor)
    const median = values[0] * 1000;
    const mean = values[1] * 1000;

    console.log(`[SCB API] Income for kommun ${kommunCode}: Median ${median} kr, Mean ${mean} kr`);

    return { median, mean };
  } catch (error: any) {
    console.error(`[SCB API] Error fetching income for kommun:`, error.message);
    return null;
  }
}

/**
 * Intern helper: Hämta inkomst-data för hela riket från TAB1507 (utan queue)
 */
async function fetchIncomeForRiket(year: string): Promise<{
  median: number;
  mean: number;
} | null> {
  const tableId = 'TAB1507';
  const url = `${SCB_API_BASE}/tables/${tableId}/data?outputFormat=json-stat2`;

  const query: SCBQuery = {
    selection: [
      {
        variableCode: "Region",
        valueCodes: ["00"] // Riket = kod "00"
      },
      {
        variableCode: "ContentsCode",
        valueCodes: ["000006T9", "000006T8"] // Median och medel
      },
      {
        variableCode: "Tid",
        valueCodes: [year]
      }
    ]
  };

  try {
    console.log(`[SCB API] Fetching income data for riket (year: ${year})`);

    const response = await axios.post<JSONStat2Response>(url, query, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const values = response.data.value;

    if (!values || values.length < 2) {
      console.error('[SCB API] Insufficient income data for riket');
      return null;
    }

    // Första värdet är median, andra är medel (i tusental kronor)
    const median = values[0] * 1000;
    const mean = values[1] * 1000;

    console.log(`[SCB API] Income for riket: Median ${median} kr, Mean ${mean} kr`);

    return { median, mean };
  } catch (error: any) {
    console.error(`[SCB API] Error fetching income for riket:`, error.message);
    return null;
  }
}

/**
 * Hämta inkomst-data för ett DeSO-område från TAB1507
 */
export async function getIncomeDataFromSCB(desoCode: string, year: string = '2023'): Promise<{
  median_income: number;
  mean_income: number;
  kommun_median?: number;
  riket_median?: number;
} | null> {
  return await queueSCBRequest(`income-${desoCode}-${year}`, async () => {
    const tableId = 'TAB1507';
    const url = `${SCB_API_BASE}/tables/${tableId}/data?outputFormat=json-stat2`;

    // TAB1507 använder INTE _DeSO2025 suffix
    const desoCodeForQuery = desoCode;

    // Extract kommun code (first 4 digits of DeSO code)
    const kommunCode = desoCode.substring(0, 4);

    const query: SCBQuery = {
      selection: [
        {
          variableCode: "Region",
          valueCodes: [desoCodeForQuery]
        },
        {
          variableCode: "ContentsCode",
          valueCodes: ["000006T9", "000006T8"] // Median och medel
        },
        {
          variableCode: "Tid",
          valueCodes: [year]
        }
      ]
    };

    try {
      console.log(`[SCB API] Fetching income data for DeSO ${desoCode} (year: ${year})`);

      // Fetch DeSO, kommun, and riket data in parallel
      const [desoResponse, kommunData, riketData] = await Promise.all([
        axios.post<JSONStat2Response>(url, query, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }),
        fetchIncomeForKommun(kommunCode, year),
        fetchIncomeForRiket(year)
      ]);

      const values = desoResponse.data.value;

      if (!values || values.length < 2) {
        console.error('[SCB API] Insufficient income data in response');
        return null;
      }

      // Första värdet är median, andra är medel (i tusental kronor)
      const medianIncome = values[0] * 1000; // Konvertera från tkr till kr
      const meanIncome = values[1] * 1000;

      console.log(`[SCB API] Income for ${desoCode}: Median ${medianIncome} kr, Mean ${meanIncome} kr`);

      return {
        median_income: medianIncome,
        mean_income: meanIncome,
        kommun_median: kommunData?.median,
        riket_median: riketData?.median
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error(`[SCB API] DeSO code not found in income table: ${desoCode}`);
      } else if (error.response) {
        console.error(`[SCB API] HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[SCB API] Error:`, error.message);
      }

      return null;
    }
  });
}

/**
 * Hämta utbildnings-data för ett DeSO-område från TAB5956
 */
export async function getEducationDataFromSCB(desoCode: string, year: string = '2023'): Promise<{
  forgymnasial: number;
  gymnasial: number;
  eftergymnasial: number;
  kommun_avg?: { forgymnasial: number; gymnasial: number; eftergymnasial: number };
  riket_avg?: { forgymnasial: number; gymnasial: number; eftergymnasial: number };
} | null> {
  return await queueSCBRequest(`education-${desoCode}-${year}`, async () => {
    const tableId = 'TAB5956';
    const url = `${SCB_API_BASE}/tables/${tableId}/data?outputFormat=json-stat2`;

    // TAB5956 använder INTE _DeSO2025 suffix
    const desoCodeForQuery = desoCode;

    const query: SCBQuery = {
      selection: [
        {
          variableCode: "Region",
          valueCodes: [desoCodeForQuery]
        },
        {
          variableCode: "UtbildningsNiva",
          valueCodes: [
            "21",    // Förgymnasial
            "3+4",   // Gymnasial
            "5",     // Eftergymnasial < 3 år
            "6"      // Eftergymnasial >= 3 år
          ]
        },
        {
          variableCode: "ContentsCode",
          valueCodes: ["000005MO"] // Befolkning
        },
        {
          variableCode: "Tid",
          valueCodes: [year]
        }
      ]
    };

    try {
      console.log(`[SCB API] Fetching education data for DeSO ${desoCode} (year: ${year})`);

      const response = await axios.post<JSONStat2Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const values = response.data.value;

      if (!values || values.length < 4) {
        console.error('[SCB API] Insufficient education data in response');
        return null;
      }

      // Värdena är absoluta antal personer per utbildningsnivå
      // Index 0: Förgymnasial (21)
      // Index 1: Gymnasial (3+4)
      // Index 2: Eftergymnasial < 3 år (5)
      // Index 3: Eftergymnasial >= 3 år (6)
      const forgymnasialCount = values[0] || 0;
      const gymnasialCount = values[1] || 0;
      const eftergymnasialCount = (values[2] || 0) + (values[3] || 0); // Kombinera 5 och 6

      const total = forgymnasialCount + gymnasialCount + eftergymnasialCount;

      if (total === 0) {
        console.error('[SCB API] No education data for area');
        return null;
      }

      // Konvertera till procent
      const forgymnasial = (forgymnasialCount / total) * 100;
      const gymnasial = (gymnasialCount / total) * 100;
      const eftergymnasial = (eftergymnasialCount / total) * 100;

      console.log(`[SCB API] Education for ${desoCode}: Förg ${forgymnasial.toFixed(1)}%, Gym ${gymnasial.toFixed(1)}%, Efter ${eftergymnasial.toFixed(1)}%`);

      return {
        forgymnasial,
        gymnasial,
        eftergymnasial,
        kommun_avg: { forgymnasial: 20, gymnasial: 45, eftergymnasial: 35 }, // TODO: Hämta från separat query
        riket_avg: { forgymnasial: 18, gymnasial: 43, eftergymnasial: 39 }    // TODO: Hämta från separat query
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error(`[SCB API] DeSO code not found in education table: ${desoCode}`);
      } else if (error.response) {
        console.error(`[SCB API] HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[SCB API] Error:`, error.message);
      }

      return null;
    }
  });
}

/**
 * Utforska metadata för en SCB-tabell
 */
export async function getTableMetadata(tableId: string): Promise<any> {
  const url = `${SCB_API_BASE}/tables/${tableId}`;

  try {
    const response = await axios.get(url, { timeout: 15000 });
    return response.data;
  } catch (error: any) {
    console.error(`[SCB API] Error fetching metadata for ${tableId}:`, error.message);
    throw error;
  }
}

/**
 * Load DeSO → RegSO mapping (cached in memory)
 */
let desoRegsoMapping: Record<string, { regso_code: string; regso_name: string; kommun_code: string; kommun_name: string }> | null = null;

function loadDesoRegsoMapping(): Record<string, { regso_code: string; regso_name: string; kommun_code: string; kommun_name: string }> {
  if (desoRegsoMapping) {
    return desoRegsoMapping;
  }

  try {
    const mappingPath = path.join(__dirname, '../data/deso-regso-mapping.json');
    const mappingData = fs.readFileSync(mappingPath, 'utf-8');
    const parsed = JSON.parse(mappingData);
    desoRegsoMapping = parsed;
    console.log(`[SCB API] Loaded DeSO → RegSO mapping: ${Object.keys(parsed).length} entries`);
    return parsed;
  } catch (error: any) {
    console.error(`[SCB API] Failed to load DeSO → RegSO mapping:`, error.message);
    throw new Error('DeSO → RegSO mapping file not found');
  }
}

/**
 * Get RegSO code from DeSO code
 */
function getRegsoFromDeso(desoCode: string): string | null {
  const mapping = loadDesoRegsoMapping();
  const regso = mapping[desoCode];

  if (!regso) {
    console.error(`[SCB API] No RegSO mapping found for DeSO ${desoCode}`);
    return null;
  }

  return regso.regso_code;
}

/**
 * Hämta flyttmönster-data för ett DeSO-område från TAB5724 (RegSO-nivå)
 */
export async function getMigrationDataFromSCB(desoCode: string, year: string = '2023'): Promise<{
  inflyttade: number;
  utflyttade: number;
  netto: number;
  domestic_net_migration_pct: number;
  international_net_migration_pct: number;
} | null> {
  return await queueSCBRequest(`migration-${desoCode}-${year}`, async () => {
    // Get RegSO code from DeSO code
    const regsoCode = getRegsoFromDeso(desoCode);

    if (!regsoCode) {
      console.error(`[SCB API] Cannot fetch migration data - no RegSO mapping for ${desoCode}`);
      return null;
    }

    const tableId = 'TAB5724';
    const url = `${SCB_API_BASE}/tables/${tableId}/data?outputFormat=json-stat2`;

    const query: SCBQuery = {
      selection: [
        {
          variableCode: "Region",
          valueCodes: [regsoCode]
        },
        {
          variableCode: "Bakgrund",
          valueCodes: ["1+2"] // Män och kvinnor
        },
        {
          variableCode: "ContentsCode",
          valueCodes: [
            "000004V8", // Inrikes flyttnetto, procent
            "000004V9"  // Utrikes flyttnetto, procent
          ]
        },
        {
          variableCode: "Tid",
          valueCodes: [year]
        }
      ]
    };

    try {
      console.log(`[SCB API] Fetching migration data for DeSO ${desoCode} → RegSO ${regsoCode} (year: ${year})`);

      const response = await axios.post<JSONStat2Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const values = response.data.value;

      if (!values || values.length < 2) {
        console.error('[SCB API] Insufficient migration data in response');
        return null;
      }

      // Värdena är i procent av befolkningen
      const domesticNetPct = values[0]; // Inrikes flyttnetto, procent
      const internationalNetPct = values[1]; // Utrikes flyttnetto, procent

      console.log(`[SCB API] Migration for ${desoCode} (RegSO ${regsoCode}): Domestic ${domesticNetPct}%, International ${internationalNetPct}%`);

      // För att konvertera procent till absoluta tal behöver vi befolkningen
      // Men för MVP kan vi returnera uppskattningar eller bara procenten
      // TODO: Hämta befolkning och beräkna absoluta tal

      return {
        inflyttade: 0, // TODO: Beräkna från procent + befolkning
        utflyttade: 0, // TODO: Beräkna från procent + befolkning
        netto: 0, // TODO: Beräkna från procent + befolkning
        domestic_net_migration_pct: domesticNetPct,
        international_net_migration_pct: internationalNetPct
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error(`[SCB API] RegSO code not found: ${regsoCode}`);
      } else if (error.response) {
        console.error(`[SCB API] HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[SCB API] Error:`, error.message);
      }

      return null;
    }
  });
}

/**
 * Get origin metrics (Swedish/Foreign background) from SCB
 * Table: UtlSvBakgGrov (000001NU) - BE0101Q
 * Supports both DeSO and kommun level
 */
export async function getOriginDataFromSCB(regionCode: string, year: string = '2024'): Promise<{
  swedish_background: number;
  foreign_background: number;
  percentage_foreign: number;
} | null> {
  return await queueSCBRequest(`origin-${regionCode}-${year}`, async () => {
    // FolkmDesoBakgrKon supports DeSO codes (BE0101Y)
    const url = `${SCB_API_V1_BASE}/START/BE/BE0101/BE0101Y/FolkmDesoBakgrKon`;

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [regionCode.length === 9 ? `${regionCode}_DeSO2025` : regionCode]
          }
        },
        {
          code: "UtlBakgrund",
          selection: {
            filter: "item",
            values: ["1", "2"] // 1=Utländsk bakgrund, 2=Svensk bakgrund
          }
        },
        {
          code: "Kon",
          selection: {
            filter: "item",
            values: ["1+2"] // 1+2 = Totalt (both genders combined)
          }
        },
        {
          code: "ContentsCode",
          selection: {
            filter: "item",
            values: ["000007Y4"] // Folkmängd
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [year]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      console.log(`[SCB API v1] Fetching origin data for region ${regionCode} (year: ${year})`);

      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data.data;

      if (!data || data.length === 0) {
        console.error('[SCB API v1] No origin data in response');
        return null;
      }

      // Parse response - key[1] is UtlBakgrund (1=Foreign, 2=Swedish)
      // We get 2 rows: one for each background type
      const swedish = data.find((d: any) => d.key[1] === '2');
      const foreign = data.find((d: any) => d.key[1] === '1');

      const swedishCount = swedish ? parseInt(swedish.values[0], 10) || 0 : 0;
      const foreignCount = foreign ? parseInt(foreign.values[0], 10) || 0 : 0;
      const total = swedishCount + foreignCount;
      const percentageForeign = total > 0 ? (foreignCount / total) * 100 : 0;

      console.log(`[SCB API v1] Origin for ${regionCode}: ${swedishCount} svensk bakgrund, ${foreignCount} utländsk bakgrund (${percentageForeign.toFixed(1)}%)`);

      return {
        swedish_background: swedishCount,
        foreign_background: foreignCount,
        percentage_foreign: percentageForeign
      };

    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error(`[SCB API v1] Region code not found: ${regionCode}`);
      } else if (error.response) {
        console.error(`[SCB API v1] HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[SCB API v1] Error:`, error.message);
      }

      return null;
    }
  });
}

/**
 * Get household metrics from SCB
 * Table: HushallDesoTyp (BE0101Y) - Households by region and household type at DeSO level
 * Uses API v1 format
 */
export async function getHouseholdDataFromSCB(regionCode: string, year: string = '2024'): Promise<{
  total_households: number;
  ensamstaende_utan_barn: number;
  ensamstaende_med_barn: number;
  par_utan_barn: number;
  familjer: number;
  ovriga: number;
  single_person?: number;
  two_person?: number;
  three_plus_person?: number;
  average_household_size: number;
} | null> {
  return await queueSCBRequest(`household-${regionCode}-${year}`, async () => {
    // HushallDesoTyp supports both DeSO and kommun codes
    const url = `${SCB_API_V1_BASE}/START/BE/BE0101/BE0101Y/HushallDesoTyp`;

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [regionCode.length === 9 ? `${regionCode}_DeSO2025` : regionCode]
          }
        },
        {
          code: "Hushallstyp",
          selection: {
            filter: "item",
            values: ["SBMB", "SBUB", "ESMB", "ESUB", "OVRIGA"]
          }
        },
        {
          code: "ContentsCode",
          selection: {
            filter: "item",
            values: ["000007Y1"] // Antal hushåll
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [year]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      console.log(`[SCB API v1] Fetching household data for region ${regionCode} (year: ${year})`);

      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data.data;

      if (!data || data.length === 0) {
        console.error('[SCB API v1] No household data in response');
        return null;
      }

      // Parse response - key[1] is household type
      const householdsByType = data.reduce((acc: any, d: any) => {
        acc[d.key[1]] = parseInt(d.values[0], 10) || 0;
        return acc;
      }, {});

      const esub = householdsByType['ESUB'] || 0; // Ensamstående utan barn
      const sbub = householdsByType['SBUB'] || 0; // Sammanboende utan barn (par)
      const esmb = householdsByType['ESMB'] || 0; // Ensamstående med barn
      const sbmb = householdsByType['SBMB'] || 0; // Sammanboende med barn (familjer)
      const ovriga = householdsByType['OVRIGA'] || 0; // Övriga hushåll

      const totalHouseholds = esub + sbub + esmb + sbmb + ovriga;

      // Calculate average household size (approximation based on types)
      const avgSize = totalHouseholds > 0
        ? ((esub * 1) + (sbub * 2) + (esmb * 2.5) + (sbmb * 3.5) + (ovriga * 2)) / totalHouseholds
        : 0;

      console.log(`[SCB API v1] Households for ${regionCode}: ${totalHouseholds} total (ESUB: ${esub}, ESMB: ${esmb}, SBUB: ${sbub}, SBMB: ${sbmb}, OVRIGA: ${ovriga}, avg: ${avgSize.toFixed(2)})`);

      // Also provide legacy size-based mapping for backwards compatibility
      const singlePerson = esub;
      const twoPerson = sbub + Math.floor(esmb * 0.5) + Math.floor(ovriga * 0.5);
      const threePlusPerson = sbmb + Math.ceil(esmb * 0.5) + Math.ceil(ovriga * 0.5);

      return {
        total_households: totalHouseholds,
        ensamstaende_utan_barn: esub,
        ensamstaende_med_barn: esmb,
        par_utan_barn: sbub,
        familjer: sbmb,
        ovriga: ovriga,
        single_person: singlePerson,
        two_person: twoPerson,
        three_plus_person: threePlusPerson,
        average_household_size: avgSize
      };

    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error(`[SCB API v1] Region code not found: ${regionCode}`);
      } else if (error.response) {
        console.error(`[SCB API v1] HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[SCB API v1] Error:`, error.message);
      }

      return null;
    }
  });
}

/**
 * Get housing type data from SCB (HushallT32Deso)
 * Returns number of persons by house type (Småhus vs Flerbostadshus)
 * Table HE0111YDeSo/HushallT32Deso - Antal personer efter hustyp på DeSO-nivå
 */
export async function getHousingTypeDataFromSCB(regionCode: string, year: string = '2024'): Promise<{
  smahus: number;
  flerbostadshus: number;
  percentage_smahus: number;
} | null> {
  return await queueSCBRequest(`housingtype-${regionCode}-${year}`, async () => {
    // HushallT32Deso supports DeSO codes - Antal personer efter hustyp
    const url = `${SCB_API_V1_BASE}/START/HE/HE0111/HE0111YDeSo/HushallT32Deso`;

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [`${regionCode}_DeSO2025`]
          }
        },
        {
          code: "Hustyp",
          selection: {
            filter: "item",
            values: ["SMÅHUS", "FLERBOST"] // Only need these two main categories
          }
        },
        {
          code: "ContentsCode",
          selection: {
            filter: "item",
            values: ["0000077F"] // Antal personer
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [year]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      console.log(`[SCB API v1] Fetching housing type data for region ${regionCode} (year: ${year})`);

      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data.data;

      if (!data || data.length === 0) {
        console.error('[SCB API v1] No housing type data in response');
        return null;
      }

      // Parse response - key[1] is hustyp code
      const values = data.map((d: any) => ({
        type: d.key[1], // SMÅHUS or FLERBOST
        count: parseInt(d.values[0], 10) || 0
      }));

      const smahus = values.find(v => v.type === 'SMÅHUS')?.count || 0;
      const flerbostadshus = values.find(v => v.type === 'FLERBOST')?.count || 0;
      const total = smahus + flerbostadshus;
      const percentageSmahus = total > 0 ? (smahus / total) * 100 : 0;

      console.log(`[SCB API v1] Housing types for ${regionCode}: ${smahus} småhus (${percentageSmahus.toFixed(1)}%), ${flerbostadshus} flerbostadshus`);

      return {
        smahus,
        flerbostadshus,
        percentage_smahus: percentageSmahus
      };

    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error(`[SCB API v1] Region code not found: ${regionCode}`);
      } else if (error.response) {
        console.error(`[SCB API v1] HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[SCB API v1] Error:`, error.message);
      }

      return null;
    }
  });
}

/**
 * Get tenure form data from SCB (HushallT22)
 * Returns number of persons by tenure form (Äganderätt, Bostadsrätt, Hyresrätt)
 * Aggregates from Boendeform
 */
export async function getTenureFormDataFromSCB(regionCode: string, year: string = '2024'): Promise<{
  aganderatt: number;
  bostadsratt: number;
  hyresratt: number;
  percentage_aganderatt: number;
  percentage_bostadsratt: number;
  percentage_hyresratt: number;
} | null> {
  return await queueSCBRequest(`tenureform-${regionCode}-${year}`, async () => {
    // BO0104T01N2 supports DeSO codes - Antal lägenheter efter region och upplåtelseform
    const url = `${SCB_API_V1_BASE}/START/BO/BO0104/BO0104X/BO0104T01N2`;

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [`${regionCode}_DeSO2025`]
          }
        },
        {
          code: "Upplatelseform",
          selection: {
            filter: "item",
            values: ["1", "2", "3"] // 1=Hyresrätt, 2=Bostadsrätt, 3=Äganderätt
          }
        },
        {
          code: "ContentsCode",
          selection: {
            filter: "item",
            values: ["00000864"] // Antal lägenheter
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [year]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      console.log(`[SCB API v1] Fetching tenure form data for region ${regionCode} (year: ${year})`);

      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data.data;

      if (!data || data.length === 0) {
        console.error('[SCB API v1] No tenure form data in response');
        return null;
      }

      // Parse response - key[1] is upplåtelseform code
      const values = data.map((d: any) => ({
        type: d.key[1], // 1=Hyresrätt, 2=Bostadsrätt, 3=Äganderätt
        count: parseInt(d.values[0], 10) || 0
      }));

      const hyresratt = values.find(v => v.type === '1')?.count || 0;
      const bostadsratt = values.find(v => v.type === '2')?.count || 0;
      const aganderatt = values.find(v => v.type === '3')?.count || 0;
      const total = hyresratt + bostadsratt + aganderatt;

      const percentageAganderatt = total > 0 ? (aganderatt / total) * 100 : 0;
      const percentageBostadsratt = total > 0 ? (bostadsratt / total) * 100 : 0;
      const percentageHyresratt = total > 0 ? (hyresratt / total) * 100 : 0;

      console.log(`[SCB API v1] Tenure forms for ${regionCode}: Äg ${percentageAganderatt.toFixed(1)}%, Bost ${percentageBostadsratt.toFixed(1)}%, Hyres ${percentageHyresratt.toFixed(1)}%`);

      return {
        aganderatt,
        bostadsratt,
        hyresratt,
        percentage_aganderatt: percentageAganderatt,
        percentage_bostadsratt: percentageBostadsratt,
        percentage_hyresratt: percentageHyresratt
      };

    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error(`[SCB API v1] Region code not found: ${regionCode}`);
      } else if (error.response) {
        console.error(`[SCB API v1] HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[SCB API v1] Error:`, error.message);
      }

      return null;
    }
  });
}

/**
 * Hämta ekonomisk standard för ett DeSO-område från TabVX3InkDesoN (gamla API v1)
 * Returnerar fördelning över kvartiler och median/medelvärden
 */
export async function getEconomicStandardFromSCB(desoCode: string, year: string = '2023'): Promise<{
  quartile_1: number;
  quartile_2: number;
  quartile_3: number;
  quartile_4: number;
  median_value: number;
  mean_value: number;
  total_persons: number;
} | null> {
  return await queueSCBRequest(`econ-std-${desoCode}-${year}`, async () => {
    const url = `${SCB_API_V1_BASE}/START/HE/HE0110/HE0110I/TabVX3InkDesoN`;

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [desoCode]
          }
        },
        {
          code: "ContentsCode",
          selection: {
            filter: "item",
            values: ["000006T4", "000006T5", "000006T6", "000006T7", "000006T9", "000006T8", "000006T3"]
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [year]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      console.log(`[SCB API v1] Fetching economic standard for DeSO ${desoCode} (year: ${year})`);

      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data.data;

      if (!data || data.length === 0) {
        console.error('[SCB API v1] No economic standard data found');
        return null;
      }

      // Parse data - values array contains all metrics in order
      // Order: quartile_1, quartile_2, quartile_3, quartile_4, median, mean, total_persons
      const result: any = {
        quartile_1: 0,
        quartile_2: 0,
        quartile_3: 0,
        quartile_4: 0,
        median_value: 0,
        mean_value: 0,
        total_persons: 0
      };

      if (data.length > 0 && data[0].values) {
        const values = data[0].values;
        result.quartile_1 = parseFloat(values[0]) || 0;
        result.quartile_2 = parseFloat(values[1]) || 0;
        result.quartile_3 = parseFloat(values[2]) || 0;
        result.quartile_4 = parseFloat(values[3]) || 0;
        result.median_value = parseFloat(values[4]) || 0;
        result.mean_value = parseFloat(values[5]) || 0;
        result.total_persons = parseInt(values[6], 10) || 0;
      }

      console.log(`[SCB API v1] Economic standard fetched for ${desoCode}:`, JSON.stringify(result, null, 2));

      return result;
    } catch (error: any) {
      console.error(`[SCB API v1] Error fetching economic standard:`, error.message);
      return null;
    }
  });
}

/**
 * Calculate 5-year change in economic standard (2019-2023)
 * Returns percentage change based on median value
 */
export async function getEconomicStandard5YearChange(desoCode: string): Promise<number | null> {
  return await queueSCBRequest(`econ-std-5y-${desoCode}`, async () => {
    const url = `${SCB_API_V1_BASE}/START/HE/HE0110/HE0110I/TabVX3InkDesoN`;

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [desoCode]
          }
        },
        {
          code: "ContentsCode",
          selection: {
            filter: "item",
            values: ["000006T9"]  // Medianvärde
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: ["2019", "2023"]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data.data;

      if (!data || data.length < 2) {
        console.warn(`[SCB API v1] Insufficient data for 5-year change calculation for ${desoCode}`);
        return null;
      }

      // data[0] is 2019, data[1] is 2023
      const value2019 = parseFloat(data[0].values[0]) || 0;
      const value2023 = parseFloat(data[1].values[0]) || 0;

      if (value2019 === 0) {
        console.warn(`[SCB API v1] Cannot calculate 5-year change, 2019 value is zero`);
        return null;
      }

      const changePercent = ((value2023 - value2019) / value2019) * 100;

      console.log(`[SCB API v1] Economic standard 5-year change for ${desoCode}: ${value2019} → ${value2023} (${changePercent.toFixed(1)}%)`);

      return changePercent;
    } catch (error: any) {
      console.error(`[SCB API v1] Error fetching 5-year economic standard change:`, error.message);
      return null;
    }
  });
}

/**
 * Calculate 5-year change in earned income (2019-2023)
 * Returns percentage change based on median value
 */
export async function getEarnedIncome5YearChange(desoCode: string): Promise<number | null> {
  return await queueSCBRequest(`earned-inc-5y-${desoCode}`, async () => {
    const url = `${SCB_API_V1_BASE}/START/HE/HE0110/HE0110I/Tab1InkDesoN`;

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [desoCode]
          }
        },
        {
          code: "InkomstTyp",
          selection: {
            filter: "item",
            values: ["SaFörInk"]  // Sammanräknad förvärvsinkomst
          }
        },
        {
          code: "ContentsCode",
          selection: {
            filter: "item",
            values: ["000006T1"]  // Medianvärde
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: ["2019", "2023"]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data.data;

      if (!data || data.length < 2) {
        console.warn(`[SCB API v1] Insufficient data for 5-year earned income change for ${desoCode}`);
        return null;
      }

      // data[0] is 2019, data[1] is 2023
      const value2019 = parseFloat(data[0].values[0]) || 0;
      const value2023 = parseFloat(data[1].values[0]) || 0;

      if (value2019 === 0) {
        console.warn(`[SCB API v1] Cannot calculate 5-year change, 2019 value is zero`);
        return null;
      }

      const changePercent = ((value2023 - value2019) / value2019) * 100;

      console.log(`[SCB API v1] Earned income 5-year change for ${desoCode}: ${value2019} → ${value2023} (${changePercent.toFixed(1)}%)`);

      return changePercent;
    } catch (error: any) {
      console.error(`[SCB API v1] Error fetching 5-year earned income change:`, error.message);
      return null;
    }
  });
}

/**
 * Hämta förvärvsinkomst för ett DeSO-område från Tab1InkDesoN (gamla API v1)
 * Returnerar fördelning över kvartiler och median/medelvärden
 */
export async function getEarnedIncomeFromSCB(desoCode: string, year: string = '2023'): Promise<{
  quartile_1: number;
  quartile_2: number;
  quartile_3: number;
  quartile_4: number;
  median_value: number;
  mean_value: number;
  total_persons: number;
} | null> {
  return await queueSCBRequest(`earned-inc-${desoCode}-${year}`, async () => {
    const url = `${SCB_API_V1_BASE}/START/HE/HE0110/HE0110I/Tab1InkDesoN`;

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [desoCode]
          }
        },
        {
          code: "InkomstTyp",
          selection: {
            filter: "item",
            values: ["SaFörInk"]  // Sammanräknad förvärvsinkomst
          }
        },
        {
          code: "Kon",
          selection: {
            filter: "item",
            values: ["1+2"]  // Båda könen
          }
        },
        {
          code: "ContentsCode",
          selection: {
            filter: "item",
            values: ["000002FI", "000003YS", "000005FJ", "000005FK", "000005FM", "000005FL", "000002FH"]
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [year]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      console.log(`[SCB API v1] Fetching earned income for DeSO ${desoCode} (year: ${year})`);

      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data.data;

      if (!data || data.length === 0) {
        console.error('[SCB API v1] No earned income data found');
        return null;
      }

      // Parse data - values array contains all metrics in order
      // Order: quartile_1, quartile_2, quartile_3, quartile_4, median, mean, total_persons
      const result: any = {
        quartile_1: 0,
        quartile_2: 0,
        quartile_3: 0,
        quartile_4: 0,
        median_value: 0,
        mean_value: 0,
        total_persons: 0
      };

      if (data.length > 0 && data[0].values) {
        const values = data[0].values;
        result.quartile_1 = parseFloat(values[0]) || 0;
        result.quartile_2 = parseFloat(values[1]) || 0;
        result.quartile_3 = parseFloat(values[2]) || 0;
        result.quartile_4 = parseFloat(values[3]) || 0;
        result.median_value = parseFloat(values[4]) || 0;
        result.mean_value = parseFloat(values[5]) || 0;
        result.total_persons = parseInt(values[6], 10) || 0;
      }

      console.log(`[SCB API v1] Earned income fetched for ${desoCode}:`, JSON.stringify(result, null, 2));

      return result;
    } catch (error: any) {
      console.error(`[SCB API v1] Error fetching earned income:`, error.message);
      return null;
    }
  });
}

/**
 * Hämta ekonomisk standard för en kommun från TabVX3InkDesoN (gamla API v1)
 */
export async function getEconomicStandardForKommun(kommunCode: string, year: string = '2023'): Promise<{
  quartile_1: number;
  quartile_2: number;
  quartile_3: number;
  quartile_4: number;
  median_value: number;
  mean_value: number;
  total_persons: number;
} | null> {
  return await queueSCBRequest(`econ-std-kommun-${kommunCode}-${year}`, async () => {
    const url = `${SCB_API_V1_BASE}/START/HE/HE0110/HE0110I/TabVX3InkDesoN`;

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [kommunCode]
          }
        },
        {
          code: "ContentsCode",
          selection: {
            filter: "item",
            values: ["000006T4", "000006T5", "000006T6", "000006T7", "000006T9", "000006T8", "000006T3"]
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [year]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      console.log(`[SCB API v1] Fetching economic standard for kommun ${kommunCode} (year: ${year})`);

      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data.data;

      if (!data || data.length === 0) {
        console.error('[SCB API v1] No economic standard data found for kommun');
        return null;
      }

      const result: any = {
        quartile_1: 0,
        quartile_2: 0,
        quartile_3: 0,
        quartile_4: 0,
        median_value: 0,
        mean_value: 0,
        total_persons: 0
      };

      if (data.length > 0 && data[0].values) {
        const values = data[0].values;
        result.quartile_1 = parseFloat(values[0]) || 0;
        result.quartile_2 = parseFloat(values[1]) || 0;
        result.quartile_3 = parseFloat(values[2]) || 0;
        result.quartile_4 = parseFloat(values[3]) || 0;
        result.median_value = parseFloat(values[4]) || 0;
        result.mean_value = parseFloat(values[5]) || 0;
        result.total_persons = parseInt(values[6], 10) || 0;
      }

      console.log(`[SCB API v1] Economic standard fetched for kommun ${kommunCode}`);

      return result;
    } catch (error: any) {
      console.error(`[SCB API v1] Error fetching economic standard for kommun:`, error.message);
      return null;
    }
  });
}

/**
 * Hämta förvärvsinkomst för en kommun från Tab1InkDesoN (gamla API v1)
 */
export async function getEarnedIncomeForKommun(kommunCode: string, year: string = '2023'): Promise<{
  quartile_1: number;
  quartile_2: number;
  quartile_3: number;
  quartile_4: number;
  median_value: number;
  mean_value: number;
  total_persons: number;
} | null> {
  return await queueSCBRequest(`earned-inc-kommun-${kommunCode}-${year}`, async () => {
    const url = `${SCB_API_V1_BASE}/START/HE/HE0110/HE0110I/Tab1InkDesoN`;

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [kommunCode]
          }
        },
        {
          code: "InkomstTyp",
          selection: {
            filter: "item",
            values: ["SaFörInk"]  // Sammanräknad förvärvsinkomst
          }
        },
        {
          code: "Kon",
          selection: {
            filter: "item",
            values: ["1+2"]  // Båda könen
          }
        },
        {
          code: "ContentsCode",
          selection: {
            filter: "item",
            values: ["000002FI", "000003YS", "000005FJ", "000005FK", "000005FM", "000005FL", "000002FH"]
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [year]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      console.log(`[SCB API v1] Fetching earned income for kommun ${kommunCode} (year: ${year})`);

      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data.data;

      if (!data || data.length === 0) {
        console.error('[SCB API v1] No earned income data found for kommun');
        return null;
      }

      const result: any = {
        quartile_1: 0,
        quartile_2: 0,
        quartile_3: 0,
        quartile_4: 0,
        median_value: 0,
        mean_value: 0,
        total_persons: 0
      };

      if (data.length > 0 && data[0].values) {
        const values = data[0].values;
        result.quartile_1 = parseFloat(values[0]) || 0;
        result.quartile_2 = parseFloat(values[1]) || 0;
        result.quartile_3 = parseFloat(values[2]) || 0;
        result.quartile_4 = parseFloat(values[3]) || 0;
        result.median_value = parseFloat(values[4]) || 0;
        result.mean_value = parseFloat(values[5]) || 0;
        result.total_persons = parseInt(values[6], 10) || 0;
      }

      console.log(`[SCB API v1] Earned income fetched for kommun ${kommunCode}`);

      return result;
    } catch (error: any) {
      console.error(`[SCB API v1] Error fetching earned income for kommun:`, error.message);
      return null;
    }
  });
}

/**
 * Kommun-level wrapper functions
 */

export async function getOriginDataForKommun(kommunCode: string, year: string = '2024') {
  return await getOriginDataFromSCB(kommunCode, year);
}

export async function getPopulationDataForKommun(kommunCode: string, year: string = '2024') {
  return await getAgeDistributionFromSCB(kommunCode, year);
}

export async function getHouseholdDataForKommun(kommunCode: string, year: string = '2024') {
  return await getHouseholdDataFromSCB(kommunCode, year);
}

/**
 * Get housing type data for kommun from SCB (HushallT21B)
 * Returns number of persons by house type (Småhus vs Flerbostadshus)
 * Table HE0111A/HushallT21B - Antal personer efter region och boendeform
 */
export async function getHousingTypeDataForKommun(kommunCode: string, year: string = '2024'): Promise<{
  smahus: number;
  flerbostadshus: number;
  percentage_smahus: number;
} | null> {
  return await queueSCBRequest(`housingtype-kommun-${kommunCode}-${year}`, async () => {
    // HushallT21B supports kommun codes - Antal personer efter boendeform
    const url = `${SCB_API_V1_BASE}/START/HE/HE0111/HE0111A/HushallT21B`;

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [kommunCode]
          }
        },
        {
          code: "Boendeform",
          selection: {
            filter: "item",
            values: ["SMAG", "SMBO", "SMHY0", "FBBO", "FBHY0"] // Småhus & Flerbostadshus categories
          }
        },
        {
          code: "Kon",
          selection: {
            filter: "item",
            values: ["4"] // 4 = Totalt (both genders)
          }
        },
        {
          code: "Alder",
          selection: {
            filter: "item",
            values: ["SAMAB"] // SAMAB = Samtliga åldrar (all ages)
          }
        },
        {
          code: "ContentsCode",
          selection: {
            filter: "item",
            values: ["HE0111AA"] // Antal personer
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [year]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      console.log(`[SCB API v1] Fetching housing type data for kommun ${kommunCode} (year: ${year})`);

      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data.data;

      if (!data || data.length === 0) {
        console.error('[SCB API v1] No housing type data in response for kommun');
        return null;
      }

      // Aggregate across all ages and genders - key[1] is boendeform code
      const aggregated = data.reduce((acc: any, d: any) => {
        const boendeform = d.key[1]; // SMAG, SMBO, SMHY0, FBBO, FBHY0
        const count = parseInt(d.values[0], 10) || 0;
        acc[boendeform] = (acc[boendeform] || 0) + count;
        return acc;
      }, {});

      // Sum småhus categories (SM*) and flerbostadshus categories (FB*)
      const smahus = (aggregated['SMAG'] || 0) + (aggregated['SMBO'] || 0) + (aggregated['SMHY0'] || 0);
      const flerbostadshus = (aggregated['FBBO'] || 0) + (aggregated['FBHY0'] || 0);
      const total = smahus + flerbostadshus;
      const percentageSmahus = total > 0 ? (smahus / total) * 100 : 0;

      console.log(`[SCB API v1] Housing types for kommun ${kommunCode}: ${smahus} småhus (${percentageSmahus.toFixed(1)}%), ${flerbostadshus} flerbostadshus`);

      return {
        smahus,
        flerbostadshus,
        percentage_smahus: percentageSmahus
      };

    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error(`[SCB API v1] Kommun code not found: ${kommunCode}`);
      } else if (error.response) {
        console.error(`[SCB API v1] HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[SCB API v1] Error:`, error.message);
      }

      return null;
    }
  });
}

export async function getTenureFormDataForKommun(kommunCode: string, year: string = '2024'): Promise<{
  aganderatt: number;
  bostadsratt: number;
  hyresratt: number;
  percentage_aganderatt: number;
  percentage_bostadsratt: number;
  percentage_hyresratt: number;
} | null> {
  return await queueSCBRequest(`tenureform-kommun-${kommunCode}-${year}`, async () => {
    // BO0104T04 supports kommun codes - Lägenheter efter region, hustyp och upplåtelseform
    const url = `${SCB_API_V1_BASE}/START/BO/BO0104/BO0104D/BO0104T04`;

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [kommunCode]
          }
        },
        {
          code: "Hustyp",
          selection: {
            filter: "all",
            values: ["*"] // All housing types
          }
        },
        {
          code: "Upplatelseform",
          selection: {
            filter: "item",
            values: ["1", "2", "3"] // 1=Hyresrätt, 2=Bostadsrätt, 3=Äganderätt
          }
        },
        {
          code: "ContentsCode",
          selection: {
            filter: "item",
            values: ["BO0104AH"] // Antal lägenheter
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [year]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      console.log(`[SCB API v1] Fetching tenure form data for kommun ${kommunCode} (year: ${year})`);

      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data.data;

      if (!data || data.length === 0) {
        console.error('[SCB API v1] No tenure form data in response for kommun');
        return null;
      }

      // Aggregate across all housing types - key[2] is upplåtelseform code
      const aggregated = data.reduce((acc: any, d: any) => {
        const type = d.key[2]; // 1=Hyresrätt, 2=Bostadsrätt, 3=Äganderätt
        const count = parseInt(d.values[0], 10) || 0;
        acc[type] = (acc[type] || 0) + count;
        return acc;
      }, {});

      const hyresratt = aggregated['1'] || 0;
      const bostadsratt = aggregated['2'] || 0;
      const aganderatt = aggregated['3'] || 0;
      const total = hyresratt + bostadsratt + aganderatt;

      const percentageAganderatt = total > 0 ? (aganderatt / total) * 100 : 0;
      const percentageBostadsratt = total > 0 ? (bostadsratt / total) * 100 : 0;
      const percentageHyresratt = total > 0 ? (hyresratt / total) * 100 : 0;

      console.log(`[SCB API v1] Tenure forms for kommun ${kommunCode}: Äg ${percentageAganderatt.toFixed(1)}%, Bost ${percentageBostadsratt.toFixed(1)}%, Hyres ${percentageHyresratt.toFixed(1)}%`);

      return {
        aganderatt,
        bostadsratt,
        hyresratt,
        percentage_aganderatt: percentageAganderatt,
        percentage_bostadsratt: percentageBostadsratt,
        percentage_hyresratt: percentageHyresratt
      };

    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error(`[SCB API v1] Kommun code not found: ${kommunCode}`);
      } else if (error.response) {
        console.error(`[SCB API v1] HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[SCB API v1] Error:`, error.message);
      }

      return null;
    }
  });
}

/**
 * Hämta fordonsdata för ett DeSO-område från PersBilarDeso (TK1001Z)
 */
export async function getVehicleDataFromSCB(desoCode: string, year: string = '2023'): Promise<{
  total_vehicles: number;
  vehicles_in_traffic: number;
  vehicles_deregistered: number;
} | null> {
  return await queueSCBRequest(`vehicles-${desoCode}-${year}`, async () => {
    const tableId = 'PersBilarDeso';
    const url = `${SCB_API_V1_BASE}/START/TK/TK1001/TK1001Z/${tableId}`;

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [desoCode]  // NO suffix for PersBilarDeso!
          }
        },
        {
          code: "Bestand",  // Variable is "Bestand" not "Status"
          selection: {
            filter: "item",
            values: ["ITRAF", "AVST", "TOT"]  // ITRAF=I trafik, AVST=Avställda, TOT=Totalt
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [year]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      console.log(`[SCB API v1] Fetching vehicle data for DeSO ${desoCode} (year: ${year})`);

      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data.data;

      if (!data || data.length === 0) {
        console.error('[SCB API v1] No vehicle data found');
        return null;
      }

      // Parse response - SCB returns one row per bestånd
      let total = 0;
      let inTraffic = 0;
      let deregistered = 0;

      data.forEach(row => {
        const bestandCode = row.key[1];  // Bestand is second dimension
        const count = parseInt(row.values[0], 10);

        if (bestandCode === 'ITRAF') {
          inTraffic = count;
        } else if (bestandCode === 'AVST') {
          deregistered = count;
        } else if (bestandCode === 'TOT') {
          total = count;
        }
      });

      console.log(`[SCB API v1] Vehicle data for ${desoCode}: Total ${total}, In traffic ${inTraffic}, Avställda ${deregistered}`);

      return {
        total_vehicles: total,
        vehicles_in_traffic: inTraffic,
        vehicles_deregistered: deregistered
      };

    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error(`[SCB API v1] DeSO code not found: ${desoCode}`);
      } else if (error.response) {
        console.error(`[SCB API v1] HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[SCB API v1] Error:`, error.message);
      }

      return null;
    }
  });
}

/**
 * Hämta fordonsdata för en kommun från PersBilarDeso aggregerad till kommun-nivå
 */
export async function getVehicleDataForKommun(kommunCode: string, year: string = '2023'): Promise<{
  total_vehicles: number;
  vehicles_in_traffic: number;
  vehicles_deregistered: number;
} | null> {
  return await queueSCBRequest(`vehicles-kommun-${kommunCode}-${year}`, async () => {
    const tableId = 'PersBilarDeso';
    const url = `${SCB_API_V1_BASE}/START/TK/TK1001/TK1001Z/${tableId}`;

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [kommunCode]  // Kommun code (e.g. "2480" for Umeå)
          }
        },
        {
          code: "Bestand",
          selection: {
            filter: "item",
            values: ["ITRAF", "AVST", "TOT"]
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [year]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      console.log(`[SCB API v1] Fetching vehicle data for kommun ${kommunCode} (year: ${year})`);

      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const data = response.data.data;

      if (!data || data.length === 0) {
        console.error('[SCB API v1] No vehicle data found for kommun');
        return null;
      }

      // Parse response
      let total = 0;
      let inTraffic = 0;
      let deregistered = 0;

      data.forEach(row => {
        const bestandCode = row.key[1];
        const count = parseInt(row.values[0], 10);

        if (bestandCode === 'ITRAF') {
          inTraffic = count;
        } else if (bestandCode === 'AVST') {
          deregistered = count;
        } else if (bestandCode === 'TOT') {
          total = count;
        }
      });

      console.log(`[SCB API v1] Vehicle data for kommun ${kommunCode}: Total ${total}, In traffic ${inTraffic}, Avställda ${deregistered}`);

      return {
        total_vehicles: total,
        vehicles_in_traffic: inTraffic,
        vehicles_deregistered: deregistered
      };

    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error(`[SCB API v1] Kommun code not found: ${kommunCode}`);
      } else if (error.response) {
        console.error(`[SCB API v1] HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[SCB API v1] Error:`, error.message);
      }

      return null;
    }
  });
}

/**
 * Get building age distribution for a DeSO area
 * Table: BostadsbyggnadAlder3 (MI0803B)
 * Returns count per construction period
 */
export async function getBuildingAgeDataFromSCB(desoCode: string, year: string = '2024'): Promise<{
  periods: { period: string; count: number }[];
  total: number;
} | null> {
  return await queueSCBRequest(`building-age-${desoCode}-${year}`, async () => {
    const tableId = 'BostadsbyggnadAlder3';
    const url = `${SCB_API_V1_BASE}/START/MI/MI0803/MI0803B/${tableId}`;

    const desoCodeWithSuffix = `${desoCode}_DeSO2025`;

    // All building periods
    const periods = ['-1920', '1921-1930', '1931-1940', '1941-1950', '1951-1960',
                     '1961-1970', '1971-1980', '1981-1990', '1991-2000', '2001-2010',
                     '2011-2020', '2021-2030'];

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [desoCodeWithSuffix]
          }
        },
        {
          code: "ByggAr",
          selection: {
            filter: "item",
            values: periods
          }
        },
        {
          code: "ContentsCode",
          selection: {
            filter: "item",
            values: ["0000080B"]  // Antal
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [year]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      console.log(`[SCB API v1] Fetching building age data for DeSO ${desoCode} (year: ${year})`);

      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (!response.data || !response.data.data || response.data.data.length === 0) {
        console.warn(`[SCB API v1] No building age data for ${desoCode}`);
        return null;
      }

      const periodData: { period: string; count: number }[] = [];
      let total = 0;

      response.data.data.forEach(row => {
        const period = row.key[1];  // ByggAr value
        const count = parseInt(row.values[0], 10);

        if (!isNaN(count) && count > 0) {
          periodData.push({ period, count });
          total += count;
        }
      });

      console.log(`[SCB API v1] Building age for ${desoCode}: ${periodData.length} periods, ${total} total buildings`);

      return { periods: periodData, total };

    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error(`[SCB API v1] DeSO code not found: ${desoCode}`);
      } else if (error.response) {
        console.error(`[SCB API v1] HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[SCB API v1] Error:`, error.message);
      }

      return null;
    }
  });
}

/**
 * Get building age distribution for a kommun
 * Table: BostadsbyggnadAlder3 (MI0803B)
 */
export async function getBuildingAgeDataForKommun(kommunCode: string, year: string = '2024'): Promise<{
  periods: { period: string; count: number }[];
  total: number;
} | null> {
  return await queueSCBRequest(`building-age-kommun-${kommunCode}-${year}`, async () => {
    const tableId = 'BostadsbyggnadAlder3';
    const url = `${SCB_API_V1_BASE}/START/MI/MI0803/MI0803B/${tableId}`;

    const periods = ['-1920', '1921-1930', '1931-1940', '1941-1950', '1951-1960',
                     '1961-1970', '1971-1980', '1981-1990', '1991-2000', '2001-2010',
                     '2011-2020', '2021-2030'];

    const query: SCBV1Query = {
      query: [
        {
          code: "Region",
          selection: {
            filter: "item",
            values: [kommunCode]
          }
        },
        {
          code: "ByggAr",
          selection: {
            filter: "item",
            values: periods
          }
        },
        {
          code: "ContentsCode",
          selection: {
            filter: "item",
            values: ["0000080B"]  // Antal
          }
        },
        {
          code: "Tid",
          selection: {
            filter: "item",
            values: [year]
          }
        }
      ],
      response: {
        format: "json"
      }
    };

    try {
      console.log(`[SCB API v1] Fetching building age data for kommun ${kommunCode} (year: ${year})`);

      const response = await axios.post<SCBV1Response>(url, query, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (!response.data || !response.data.data || response.data.data.length === 0) {
        console.warn(`[SCB API v1] No building age data for kommun ${kommunCode}`);
        return null;
      }

      const periodData: { period: string; count: number }[] = [];
      let total = 0;

      response.data.data.forEach(row => {
        const period = row.key[1];
        const count = parseInt(row.values[0], 10);

        if (!isNaN(count) && count > 0) {
          periodData.push({ period, count });
          total += count;
        }
      });

      console.log(`[SCB API v1] Building age for kommun ${kommunCode}: ${periodData.length} periods, ${total} total buildings`);

      return { periods: periodData, total };

    } catch (error: any) {
      if (error.response?.status === 404) {
        console.error(`[SCB API v1] Kommun code not found: ${kommunCode}`);
      } else if (error.response) {
        console.error(`[SCB API v1] HTTP ${error.response.status}:`, error.response.data);
      } else {
        console.error(`[SCB API v1] Error:`, error.message);
      }

      return null;
    }
  });
}

export default {
  getAgeDistributionFromSCB,
  getTotalPopulationFromSCB,
  getHistoricalPopulationFromSCB,
  getIncomeDataFromSCB,
  getEducationDataFromSCB,
  getMigrationDataFromSCB,
  getOriginDataFromSCB,
  getHouseholdDataFromSCB,
  getHousingTypeDataFromSCB,
  getTenureFormDataFromSCB,
  getEconomicStandardFromSCB,
  getEconomicStandard5YearChange,
  getEarnedIncomeFromSCB,
  getEarnedIncome5YearChange,
  getEconomicStandardForKommun,
  getEarnedIncomeForKommun,
  getVehicleDataFromSCB,
  getVehicleDataForKommun,
  getBuildingAgeDataFromSCB,
  getBuildingAgeDataForKommun,
  getTableMetadata
};
