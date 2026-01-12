import axios from 'axios';
import { query, initializeDatabase, checkConnection } from '../src/config/database';

const SCB_WFS_URL = 'https://geodata.scb.se/geoserver/stat/wfs';

interface DeSoFeature {
  type: 'Feature';
  properties: {
    deso: string;
    deso_name?: string;
    kommun: string;
    kommunnamn?: string;
    lan: string;
    lansnamn?: string;
    kategori?: string;
    befolkning?: number;
  };
  geometry: {
    type: 'MultiPolygon';
    coordinates: number[][][][];
  };
}

interface DeSoFeatureCollection {
  type: 'FeatureCollection';
  features: DeSoFeature[];
}

async function importDeSoGeodata() {
  console.log('🚀 Starting DeSO geodata import from SCB...\n');

  // Step 1: Check database connection
  console.log('1. Checking database connection...');
  const connected = await checkConnection();
  if (!connected) {
    console.error('❌ Database connection failed. Make sure PostgreSQL is running.');
    console.error('   Run: docker-compose up -d');
    process.exit(1);
  }

  // Step 2: Initialize database schema
  console.log('\n2. Initializing database schema...');
  await initializeDatabase();

  // Step 3: Check if data already exists
  console.log('\n3. Checking for existing DeSO data...');
  const existingCount = await query('SELECT COUNT(*) FROM deso_areas');
  const count = parseInt(existingCount.rows[0].count, 10);

  if (count > 0) {
    console.log(`⚠️  Found ${count} existing DeSO areas in database.`);
    console.log('   This import will skip duplicates and add only new areas.\n');
  }

  // Step 4: Fetch DeSO data from SCB WFS
  console.log('4. Fetching DeSO 2025 geodata from SCB WFS...');
  console.log(`   URL: ${SCB_WFS_URL}`);
  console.log('   This may take 1-2 minutes...\n');

  const params = {
    service: 'wfs',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: 'stat:DeSO_2025', // WFS 2.0 uses typeNames (plural)
    outputFormat: 'application/json',
    srsName: 'EPSG:4326' // WGS84 for Mapbox compatibility
  };

  let geojson: DeSoFeatureCollection;

  try {
    const response = await axios.get<DeSoFeatureCollection>(SCB_WFS_URL, {
      params,
      timeout: 120000 // 2 minute timeout
    });

    geojson = response.data;

    if (!geojson.features || geojson.features.length === 0) {
      console.error('❌ No features returned from SCB WFS');
      console.error('   The API might be down or the typeName might have changed.');
      console.error('   Try checking: https://geodata.scb.se/geoserver/stat/wfs?request=GetCapabilities');
      process.exit(1);
    }

    console.log(`✓ Fetched ${geojson.features.length} DeSO areas`);

    // Debug: Log first feature to see structure
    if (geojson.features.length > 0) {
      console.log('\n   📋 Sample feature properties:');
      console.log('   ', JSON.stringify(geojson.features[0].properties, null, 2).substring(0, 300));
    }
  } catch (error: any) {
    console.error('❌ Failed to fetch DeSO data from SCB WFS');

    if (error.code === 'ECONNABORTED') {
      console.error('   Request timed out. SCB server might be slow.');
    } else if (error.response) {
      console.error(`   HTTP ${error.response.status}: ${error.response.statusText}`);
      if (error.response.data) {
        console.error('   Response:', JSON.stringify(error.response.data).substring(0, 500));
      }
    } else {
      console.error(`   ${error.message}`);
    }

    console.error('\n   💡 Trying to check available layers...');
    console.error('   Visit: https://geodata.scb.se/geoserver/stat/wfs?request=GetCapabilities');
    console.error('   Look for available DeSO layers (DeSO_2018_v2, DeSO_2015, etc.)');

    process.exit(1);
  }

  // Step 5: Import data into database
  console.log('\n5. Importing DeSO areas into database...');
  console.log('   This may take 5-10 minutes for ~6,000 areas...\n');

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < geojson.features.length; i++) {
    const feature = geojson.features[i];

    if (i % 500 === 0 && i > 0) {
      console.log(`   Progress: ${i}/${geojson.features.length} (${Math.round(i / geojson.features.length * 100)}%)`);
    }

    try {
      const props = feature.properties;

      // Skip features without deso code
      if (!props.deso && !props.deso_kod && !props.desokod) {
        skipped++;
        if (failed + skipped < 10) {
          console.warn(`   ⚠️  Skipping feature without deso_code:`, Object.keys(props));
        }
        continue;
      }

      // Get deso_code (try different property names)
      const desoCode = props.deso || props.deso_kod || props.desokod;

      // Determine category from DeSO code (5th character, index 4)
      // Format: KKKKAZZZ (K=kommun, A=category A/B/C, Z=area number)
      let category: 'A' | 'B' | 'C' = 'C';
      if (props.kategori) {
        category = props.kategori.toUpperCase() as 'A' | 'B' | 'C';
      } else if (desoCode && desoCode.length >= 5) {
        const cat = desoCode[4].toUpperCase();
        if (cat === 'A' || cat === 'B' || cat === 'C') {
          category = cat;
        }
      }

      await query(
        `INSERT INTO deso_areas (
          deso_code,
          name,
          kommun_code,
          kommun_name,
          lan_code,
          lan_name,
          category,
          population,
          geom
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_GeomFromGeoJSON($9))
        ON CONFLICT (deso_code) DO NOTHING`,
        [
          desoCode,
          props.deso_name || props.namn || `DeSO ${desoCode}`,
          props.kommun || props.kommun_kod,
          props.kommunnamn || props.kommun_namn || null,
          props.lan || props.lan_kod,
          props.lansnamn || props.lan_namn || null,
          category,
          props.befolkning || props.population || null,
          JSON.stringify(feature.geometry)
        ]
      );

      imported++;
    } catch (error: any) {
      failed++;
      if (failed < 10) {
        console.error(`   ⚠️  Failed to import feature:`, error.message);
      }
    }
  }

  skipped = geojson.features.length - imported - failed;

  // Step 6: Verify import
  console.log('\n6. Verifying import...');
  const finalCount = await query('SELECT COUNT(*) FROM deso_areas');
  const totalInDb = parseInt(finalCount.rows[0].count, 10);

  console.log('\n' + '='.repeat(60));
  console.log('✅ DeSO GEODATA IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Imported:    ${imported} new areas`);
  console.log(`Skipped:     ${skipped} duplicates`);
  console.log(`Failed:      ${failed} errors`);
  console.log(`Total in DB: ${totalInDb} DeSO areas`);
  console.log('='.repeat(60));

  // Step 7: Show sample data
  console.log('\n7. Sample DeSO areas:');
  const samples = await query(`
    SELECT deso_code, name, kommun_name, category, population
    FROM deso_areas
    ORDER BY population DESC NULLS LAST
    LIMIT 5
  `);

  console.table(samples.rows);

  console.log('\n✅ Import successful! You can now start the backend server.');
  console.log('   Run: npm run dev\n');
}

// Run import
importDeSoGeodata()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
