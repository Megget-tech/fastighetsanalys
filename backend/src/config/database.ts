import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Export pool for graceful shutdown
export { pool };

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export const getClient = (): Promise<PoolClient> => {
  return pool.connect();
};

// Initialize database schema
export async function initializeDatabase() {
  try {
    console.log('Initializing database schema...');

    // Create PostGIS extension
    await query('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('✓ PostGIS extension enabled');

    // Create deso_areas table
    await query(`
      CREATE TABLE IF NOT EXISTS deso_areas (
        deso_code VARCHAR(9) PRIMARY KEY,
        name VARCHAR(255),
        kommun_code VARCHAR(4),
        kommun_name VARCHAR(255),
        lan_code VARCHAR(2),
        lan_name VARCHAR(100),
        category CHAR(1) CHECK (category IN ('A', 'B', 'C')),
        population INTEGER,
        geom GEOMETRY(MultiPolygon, 4326),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ deso_areas table created');

    // Create spatial index on geometry
    await query(`
      CREATE INDEX IF NOT EXISTS idx_deso_geom
      ON deso_areas USING GIST(geom);
    `);
    console.log('✓ Spatial index created');

    // Create other indexes
    await query(`
      CREATE INDEX IF NOT EXISTS idx_deso_kommun
      ON deso_areas(kommun_code);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_deso_lan
      ON deso_areas(lan_code);
    `);
    console.log('✓ Additional indexes created');

    // Create scb_time_series table
    await query(`
      CREATE TABLE IF NOT EXISTS scb_time_series (
        id SERIAL PRIMARY KEY,
        deso_code VARCHAR(9) REFERENCES deso_areas(deso_code),
        metric_type VARCHAR(50) NOT NULL,
        metric_name VARCHAR(100),
        time_period DATE NOT NULL,
        value DECIMAL(15,2),
        unit VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ scb_time_series table created');

    // Create index for time series queries
    await query(`
      CREATE INDEX IF NOT EXISTS idx_scb_deso_metric
      ON scb_time_series(deso_code, metric_type, time_period);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_scb_metric_type
      ON scb_time_series(metric_type);
    `);
    console.log('✓ Time series indexes created');

    // Create api_cache table
    await query(`
      CREATE TABLE IF NOT EXISTS api_cache (
        cache_key VARCHAR(255) PRIMARY KEY,
        api_source VARCHAR(50) NOT NULL,
        response_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL
      );
    `);
    console.log('✓ api_cache table created');

    // Create index for cache expiration
    await query(`
      CREATE INDEX IF NOT EXISTS idx_cache_expires
      ON api_cache(expires_at);
    `);
    console.log('✓ Cache index created');

    // Create booli_sales table (individual sold properties)
    await query(`
      CREATE TABLE IF NOT EXISTS booli_sales (
        id SERIAL PRIMARY KEY,
        address VARCHAR(255),
        price DECIMAL(12,2),
        price_per_sqm DECIMAL(10,2),
        monthly_fee DECIMAL(10,2),
        property_type VARCHAR(50),
        rooms DECIMAL(3,1),
        living_area DECIMAL(6,2),
        days_on_booli DECIMAL(10,1),
        sale_start TIMESTAMP,
        sold_date TIMESTAMP,
        status VARCHAR(100),
        category VARCHAR(20) CHECK (category IN ('nyproduktion', 'succession')),
        brf VARCHAR(255),
        build_year DECIMAL(6,1),
        floor DECIMAL(4,1),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ booli_sales table created');

    // Create index for booli_sales
    await query(`
      CREATE INDEX IF NOT EXISTS idx_booli_sales_category
      ON booli_sales(category);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_booli_sales_sold_date
      ON booli_sales(sold_date);
    `);
    console.log('✓ booli_sales indexes created');

    // Create booli_trends table (weekly market statistics)
    await query(`
      CREATE TABLE IF NOT EXISTS booli_trends (
        id SERIAL PRIMARY KEY,
        year INTEGER NOT NULL,
        period VARCHAR(50) NOT NULL,
        start_date DATE,
        end_date DATE,
        supply DECIMAL(10,1),
        avg_bid_premium DECIMAL(6,2),
        median_days_on_booli DECIMAL(10,1),
        percent_price_reduced DECIMAL(5,2),
        avg_price_per_sqm DECIMAL(10,2),
        avg_final_price DECIMAL(12,2),
        category VARCHAR(20) CHECK (category IN ('nyproduktion', 'succession')),
        region VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(year, period, category, region)
      );
    `);
    console.log('✓ booli_trends table created');

    // Create index for booli_trends
    await query(`
      CREATE INDEX IF NOT EXISTS idx_booli_trends_category
      ON booli_trends(category, year, period);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_booli_trends_region
      ON booli_trends(region);
    `);
    console.log('✓ booli_trends indexes created');

    console.log('✅ Database initialization complete!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Cleanup expired cache entries
export async function cleanupCache() {
  try {
    const result = await query(`
      DELETE FROM api_cache
      WHERE expires_at < NOW() - INTERVAL '7 days'
    `);
    console.log(`Cleaned up ${result.rowCount} expired cache entries`);
  } catch (error) {
    console.error('Cache cleanup failed:', error);
  }
}

// Check database connection
export async function checkConnection() {
  try {
    const result = await query('SELECT NOW()');
    console.log('✅ Database connected:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

export default {
  query,
  getClient,
  initializeDatabase,
  cleanupCache,
  checkConnection
};
