# SCB API Integration Guide

## Översikt

Denna guide visar hur man hämtar riktig data från SCB (Statistiska Centralbyrån) istället för mock-data.

## API Information

**Base URL:** `https://statistikdatabasen.scb.se/api/v2/`

**Rate Limits:**
- Max 30 anrop per 10 sekunder
- Max 150,000 dataceller per förfrågan
- Gratis att använda (CC0-licens)

## Funna Tabeller (DeSO 2025)

### Åldersfördelning
- **ID:** TAB6574 (FolkmDesoAldKon)
- **Beskrivning:** Folkmängd per region efter ålder och kön, År 2010-2024
- **URL:** https://www.statistikdatabasen.scb.se/pxweb/sv/ssd/START__BE__BE0101__BE0101Y/FolkmDesoAldKon/

### Flyttmönster
- **Utforskas:** DeSO-tabeller för migration behöver identifieras
- **Utgångspunkt:** https://www.statistikdatabasen.scb.se/pxweb/sv/ssd/START__BE__BE0101__BE0101Y/

## API Endpoints

### 1. Hämta Tabell-metadata
```
GET https://statistikdatabasen.scb.se/api/v2/tables/TAB6574
```

**Response:** JSON-Stat2 format med metadata om tillgängliga variabler

### 2. Hämta Data
```
GET https://statistikdatabasen.scb.se/api/v2/tables/TAB6574/data
```

**Query Parameters:**
- `region`: DeSO-kod (t.ex. "0180A001")
- `ålder`: Åldersgrupp (t.ex. "0-19", "20-64", "65+")
- `kön`: "1" (män), "2" (kvinnor), "1+2" (totalt)
- `år`: År (t.ex. "2024")

## Exempel: Node.js Implementation

### Steg 1: Utforska tabell-struktur

```typescript
import axios from 'axios';

async function exploreTable(tableId: string) {
  const url = `https://statistikdatabasen.scb.se/api/v2/tables/${tableId}`;

  try {
    const response = await axios.get(url);
    console.log('Tabell metadata:', JSON.stringify(response.data, null, 2));

    // Skriv ut tillgängliga variabler
    if (response.data.variables) {
      console.log('\n=== Tillgängliga variabler ===');
      response.data.variables.forEach((v: any) => {
        console.log(`${v.code}: ${v.text}`);
        console.log(`  Values: ${v.values.slice(0, 5).join(', ')}...`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Utforska åldersfördelning-tabellen
exploreTable('TAB6574');
```

### Steg 2: Hämta data för specifikt DeSO-område

```typescript
async function getAgeDistribution(desoCode: string, year: string = '2024') {
  const url = `https://statistikdatabasen.scb.se/api/v2/tables/TAB6574/data`;

  // POST request med query i body
  const query = {
    query: [
      {
        code: "Region",
        selection: {
          filter: "item",
          values: [desoCode] // T.ex. "0180A001"
        }
      },
      {
        code: "Alder",
        selection: {
          filter: "item",
          values: ["0-19", "20-39", "40-64", "65-"] // Åldersgrupper
        }
      },
      {
        code: "Kon",
        selection: {
          filter: "item",
          values: ["1+2"] // Totalt (både män och kvinnor)
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
      format: "json-stat2"
    }
  };

  try {
    const response = await axios.post(url, query, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    return parseAgeDistribution(response.data);
  } catch (error: any) {
    console.error('SCB API error:', error.message);
    throw error;
  }
}

function parseAgeDistribution(jsonStat: any) {
  // Extrahera data från JSON-Stat2 format
  const values = jsonStat.value;
  const ageGroups = jsonStat.dimension.Alder.category.index;

  const distribution: { [key: string]: number } = {};

  Object.keys(ageGroups).forEach((ageGroup, index) => {
    distribution[ageGroup] = values[index] || 0;
  });

  return {
    '0-19': distribution['0-19'] || 0,
    '20-39': distribution['20-39'] || 0,
    '40-64': distribution['40-64'] || 0,
    '65+': distribution['65-'] || 0
  };
}
```

### Steg 3: Uppdatera scb.service.ts

```typescript
// backend/src/services/scb.service.ts

export async function getPopulationMetrics(desoCode: string): Promise<PopulationMetrics> {
  const cacheKey = generateCacheKey('scb', `population-${desoCode}`, {});

  return getCachedOrFetch(
    cacheKey,
    'scb',
    async () => {
      return await queueSCBRequest(`population-${desoCode}`, async () => {
        console.log(`[SCB] Fetching REAL population data for DeSO ${desoCode}`);

        try {
          // Hämta riktig data från SCB API
          const ageData = await getAgeDistribution(desoCode);
          const total = Object.values(ageData).reduce((sum, val) => sum + val, 0);

          return {
            total,
            growth_rate: await calculateGrowthRate(desoCode), // Separat funktion
            age_distribution: ageData
          };
        } catch (error) {
          console.error(`[SCB] Failed to fetch real data, using fallback:`, error);

          // Fallback till mock-data om API misslyckas
          return getMockPopulationMetrics(desoCode);
        }
      });
    },
    86400
  );
}
```

## Hitta Flyttmönster-tabell

### Manuell Process

1. **Gå till DeSO-tabeller:**
   https://www.statistikdatabasen.scb.se/pxweb/sv/ssd/START__BE__BE0101__BE0101Y/

2. **Leta efter tabeller med "flyttning" eller "migration" i namnet**

3. **Klicka på en tabell och inspektera URL:en**
   - URL-formatet är: `.../[TABLE_ID]/`
   - T.ex: `FolkmDesoAldKon` blev `TAB6574`

4. **Konvertera till API-endpoint:**
   ```
   https://statistikdatabasen.scb.se/api/v2/tables/[TABLE_ID]
   ```

### Programmatisk Discovery

```typescript
async function findMigrationTable() {
  // Lista alla tabeller i BE0101Y-kategorin
  const url = 'https://statistikdatabasen.scb.se/api/v2/tables';

  try {
    const response = await axios.get(url);

    // Filtrera på nyckelord
    const migrationTables = response.data.tables.filter((table: any) =>
      table.text.toLowerCase().includes('flytt') ||
      table.text.toLowerCase().includes('migration') ||
      table.text.toLowerCase().includes('inflyttning') ||
      table.text.toLowerCase().includes('utflyttning')
    );

    console.log('Funna flyttmönster-tabeller:', migrationTables);
    return migrationTables;
  } catch (error) {
    console.error('Error listing tables:', error);
  }
}
```

## Resurser

- **SCB PxWebAPI 2.0 Dokumentation:** https://www.scb.se/en/services/open-data-api/pxwebapi/pxapi-2.0
- **Swagger UI (API Explorer):** https://statistikdatabasen.scb.se/api/v2/index.html
- **DeSO Information:** https://www.scb.se/hitta-statistik/regional-statistik-och-kartor/regionala-indelningar/deso---demografiska-statistikomraden/deso-tabellerna-i-ssd--information-och-instruktioner/
- **GitHub Exempel (Python/R):** https://github.com/adamstj/scb-api-examples
- **Öppna Data Portal:** https://www.scb.se/vara-tjanster/oppna-data/

## Nästa Steg

1. ✅ **Utforska TAB6574** för åldersfördelning (klar implementationsexempel ovan)
2. 🔍 **Hitta flyttmönster-tabell** (använd discovery-metoden)
3. 🔨 **Implementera i scb.service.ts** (ersätt mock-funktioner)
4. 🧪 **Testa med olika DeSO-koder**
5. 📊 **Verifiera data mot SCB:s webbgränssnitt**

## Tips

- **Använd cache aggressivt** - SCB-data uppdateras sällan
- **Hantera fel gracefully** - Fallback till mock-data om API är nere
- **Batch requests** - Använd rate limiter för att undvika throttling
- **Logga API-svar** - Hjälper med debugging av dataformat
