import axios from 'axios';

/**
 * Script för att utforska SCB PxWebAPI 2.0 och hitta rätt tabeller för DeSO-data
 *
 * Kör med: npx tsx scripts/explore-scb-api.ts
 */

const SCB_API_BASE = 'https://statistikdatabasen.scb.se/api/v2';

// Kända tabell-ID:n att utforska
const KNOWN_TABLES = {
  age_distribution: 'TAB6574', // FolkmDesoAldKon - Åldersfördelning
  // Lägg till fler när vi hittar dem
};

/**
 * Hämta metadata för en tabell
 */
async function exploreTable(tableId: string) {
  const url = `${SCB_API_BASE}/tables/${tableId}`;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Utforskar tabell: ${tableId}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(70));

  try {
    const response = await axios.get(url, { timeout: 15000 });
    const metadata = response.data;

    console.log(`\nTabell: ${metadata.label || 'N/A'}`);
    console.log(`Beskrivning: ${metadata.description || 'N/A'}`);
    console.log(`Uppdaterad: ${metadata.updated || 'N/A'}`);

    if (metadata.variables) {
      console.log(`\n--- Tillgängliga Variabler (${metadata.variables.length}) ---`);

      metadata.variables.forEach((variable: any, index: number) => {
        console.log(`\n${index + 1}. ${variable.code} - ${variable.text}`);
        console.log(`   Typ: ${variable.type || 'N/A'}`);
        console.log(`   Antal värden: ${variable.values?.length || 0}`);

        // Visa första 10 värden
        if (variable.values && variable.values.length > 0) {
          const sampleValues = variable.values.slice(0, 10);
          const sampleLabels = variable.valueTexts?.slice(0, 10) || [];

          console.log(`   Exempel värden:`);
          sampleValues.forEach((val: string, i: number) => {
            const label = sampleLabels[i] || val;
            console.log(`     - ${val}: ${label}`);
          });

          if (variable.values.length > 10) {
            console.log(`     ... och ${variable.values.length - 10} till`);
          }
        }
      });
    }

    console.log(`\n--- Metadata Sparad ---`);
    console.log(`Spara till fil med:`);
    console.log(`node -e "console.log(JSON.stringify(${JSON.stringify(metadata)}, null, 2))" > ${tableId}_metadata.json`);

    return metadata;
  } catch (error: any) {
    if (error.response) {
      console.error(`❌ HTTP ${error.response.status}: ${error.response.statusText}`);
      if (error.response.data) {
        console.error('Response:', JSON.stringify(error.response.data).substring(0, 500));
      }
    } else {
      console.error(`❌ Error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Hämta exempel-data från en tabell
 */
async function fetchSampleData(tableId: string, desoCode: string = '0180A001') {
  const url = `${SCB_API_BASE}/tables/${tableId}/data`;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Hämtar exempel-data för tabell: ${tableId}`);
  console.log(`DeSO-kod: ${desoCode}`);
  console.log('='.repeat(70));

  // Generisk query som försöker hämta data för ett DeSO-område
  const query = {
    query: [
      {
        code: "Region",
        selection: {
          filter: "item",
          values: [desoCode]
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

    console.log('\n✅ Data hämtad!');
    console.log('Response struktur:');
    console.log(JSON.stringify(response.data, null, 2).substring(0, 1000));
    console.log('...\n');

    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error(`❌ HTTP ${error.response.status}: ${error.response.statusText}`);

      // Försök extrahera användbart felmeddelande
      if (error.response.data) {
        const errorData = error.response.data;
        console.error('Fel:', errorData.message || errorData);

        // Om vi får info om vilka variabler som krävs
        if (errorData.query) {
          console.log('\n💡 API förväntar följande query-struktur:');
          console.log(JSON.stringify(errorData.query, null, 2));
        }
      }
    } else {
      console.error(`❌ Error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Sök efter tabeller med specifika nyckelord
 */
async function searchTables(keywords: string[]) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Söker tabeller med nyckelord: ${keywords.join(', ')}`);
  console.log('='.repeat(70));

  // OBS: Detta endpoint kanske inte finns i SCB API 2.0
  // Vi kan behöva använda web scraping eller manuell utforskning istället
  console.log('\n⚠️  SCB API 2.0 har inget sök-endpoint ännu.');
  console.log('Använd istället:');
  console.log('1. https://www.statistikdatabasen.scb.se/pxweb/sv/ssd/START__BE__BE0101__BE0101Y/');
  console.log('2. Sök manuellt efter tabeller med nyckelord i namnet');
  console.log('3. Kopiera tabell-ID från URL:en (t.ex. FolkmDesoAldKon)');
  console.log('4. Kör detta script med det ID:t för att utforska strukturen');
}

/**
 * Konstruera en korrekt query baserat på tabell-metadata
 */
async function buildQueryFromMetadata(tableId: string, desoCode: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Bygger query för tabell: ${tableId}`);
  console.log('='.repeat(70));

  const metadata = await exploreTable(tableId);

  if (!metadata || !metadata.variables) {
    console.error('Kunde inte hämta metadata');
    return null;
  }

  console.log('\n📝 Genererar exempel-query...\n');

  const query: any = {
    query: [],
    response: {
      format: "json-stat2"
    }
  };

  // Bygg query för varje variabel
  metadata.variables.forEach((variable: any) => {
    const varQuery: any = {
      code: variable.code,
      selection: {
        filter: "item",
        values: []
      }
    };

    // Om det är Region-variabeln, använd DeSO-koden
    if (variable.code === 'Region' || variable.code === 'region') {
      varQuery.selection.values = [desoCode];
    }
    // Annars, ta första 5 värden som exempel
    else if (variable.values && variable.values.length > 0) {
      varQuery.selection.values = variable.values.slice(0, Math.min(5, variable.values.length));
    }

    query.query.push(varQuery);
  });

  console.log('Exempel-query:');
  console.log(JSON.stringify(query, null, 2));

  console.log('\n💡 Använd denna query-struktur i ditt API-anrop!');
  console.log(`\ncurl -X POST ${SCB_API_BASE}/tables/${tableId}/data \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '${JSON.stringify(query)}'`);

  return query;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('\n🔍 SCB API Explorer');
  console.log('='.repeat(70));

  if (!command || command === 'help') {
    console.log('\nAnvändning:');
    console.log('  npx tsx scripts/explore-scb-api.ts explore <TABLE_ID>');
    console.log('  npx tsx scripts/explore-scb-api.ts sample <TABLE_ID> [DESO_CODE]');
    console.log('  npx tsx scripts/explore-scb-api.ts query <TABLE_ID> [DESO_CODE]');
    console.log('  npx tsx scripts/explore-scb-api.ts search <KEYWORD>');
    console.log('\nExempel:');
    console.log('  npx tsx scripts/explore-scb-api.ts explore TAB6574');
    console.log('  npx tsx scripts/explore-scb-api.ts sample TAB6574 0180A001');
    console.log('  npx tsx scripts/explore-scb-api.ts query TAB6574 0180A001');
    console.log('  npx tsx scripts/explore-scb-api.ts search flyttning');
    console.log('\nKända tabeller:');
    Object.entries(KNOWN_TABLES).forEach(([name, id]) => {
      console.log(`  ${name}: ${id}`);
    });
    return;
  }

  switch (command) {
    case 'explore':
      const tableId = args[1];
      if (!tableId) {
        console.error('❌ Tabell-ID saknas!');
        console.log('Exempel: npx tsx scripts/explore-scb-api.ts explore TAB6574');
        return;
      }
      await exploreTable(tableId);
      break;

    case 'sample':
      const sampleTableId = args[1];
      const sampleDeso = args[2] || '0180A001';
      if (!sampleTableId) {
        console.error('❌ Tabell-ID saknas!');
        return;
      }
      await fetchSampleData(sampleTableId, sampleDeso);
      break;

    case 'query':
      const queryTableId = args[1];
      const queryDeso = args[2] || '0180A001';
      if (!queryTableId) {
        console.error('❌ Tabell-ID saknas!');
        return;
      }
      await buildQueryFromMetadata(queryTableId, queryDeso);
      break;

    case 'search':
      const keyword = args[1];
      if (!keyword) {
        console.error('❌ Sök-ord saknas!');
        return;
      }
      await searchTables([keyword]);
      break;

    default:
      console.error(`❌ Okänt kommando: ${command}`);
      console.log('Kör "npx tsx scripts/explore-scb-api.ts help" för hjälp');
  }

  console.log('\n✅ Klart!\n');
}

// Kör main
main().catch(error => {
  console.error('\n❌ Fel:', error);
  process.exit(1);
});
