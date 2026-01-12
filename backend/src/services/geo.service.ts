import { query } from '../config/database';
import { GeoJSONPolygon, AreaMatchResult, DeSoArea } from '../models/types';

/**
 * Find DeSO areas that intersect with a given polygon
 */
export async function findDeSoByPolygon(
  polygon: GeoJSONPolygon,
  minOverlapPercentage: number = 0.1
): Promise<AreaMatchResult> {
  try {
    console.log('[Geo] Finding DeSO areas for polygon...');

    // PostGIS query to find intersecting DeSO areas
    const result = await query(
      `SELECT
        deso_code,
        name as deso_name,
        kommun_code,
        kommun_name,
        lan_code,
        category,
        population,
        ST_Area(ST_Intersection(
          geom,
          ST_GeomFromGeoJSON($1)
        )) / ST_Area(geom) AS overlap_ratio,
        ST_Area(ST_Intersection(
          geom,
          ST_GeomFromGeoJSON($1)
        )) AS overlap_area
      FROM deso_areas
      WHERE ST_Intersects(
        geom,
        ST_GeomFromGeoJSON($1)
      )
      ORDER BY overlap_ratio DESC`,
      [JSON.stringify(polygon)]
    );

    const warnings: string[] = [];

    // No intersections found
    if (result.rows.length === 0) {
      console.log('[Geo] No DeSO intersections found, using fallback...');
      return await fallbackToNearestKommun(polygon);
    }

    // Filter areas with sufficient overlap
    const relevantAreas = result.rows.filter(
      row => parseFloat(row.overlap_ratio) >= minOverlapPercentage
    );

    if (relevantAreas.length === 0) {
      warnings.push('Polygon för liten - använder närmaste DeSO');
      // Use the closest DeSO even if overlap is small
      relevantAreas.push(result.rows[0]);
    }

    // Calculate total coverage
    const totalOverlap = relevantAreas.reduce(
      (sum, row) => sum + parseFloat(row.overlap_ratio),
      0
    );
    const coveragePercentage = Math.min(totalOverlap, 1.0);

    // Check if polygon spans multiple kommuner
    const kommuner = new Set(relevantAreas.map(row => row.kommun_code));
    if (kommuner.size > 1) {
      warnings.push(`Området spänner över ${kommuner.size} kommuner`);
    }

    // Get the most common kommun (for fallback)
    const kommunCounts = relevantAreas.reduce((acc, row) => {
      acc[row.kommun_code] = (acc[row.kommun_code] || 0) + parseFloat(row.overlap_ratio);
      return acc;
    }, {} as Record<string, number>);

    const primaryKommun = Object.entries(kommunCounts).sort(([, a], [, b]) => (b as number) - (a as number))[0][0];

    console.log(`[Geo] Found ${relevantAreas.length} matching DeSO areas`);
    console.log(`[Geo] Coverage: ${(coveragePercentage * 100).toFixed(1)}%`);

    return {
      deso_codes: relevantAreas.map(row => row.deso_code),
      coverage_percentage: coveragePercentage,
      fallback_kommun: primaryKommun,
      warnings
    };
  } catch (error: any) {
    console.error('[Geo] Error finding DeSO areas:', error);
    throw new Error(`Failed to find DeSO areas: ${error.message}`);
  }
}

/**
 * Fallback: Find nearest kommun when no DeSO intersection
 */
async function fallbackToNearestKommun(
  polygon: GeoJSONPolygon
): Promise<AreaMatchResult> {
  try {
    // Get centroid of polygon and find nearest DeSO
    const result = await query(
      `SELECT
        deso_code,
        kommun_code,
        kommun_name,
        ST_Distance(
          geom,
          ST_Centroid(ST_GeomFromGeoJSON($1))
        ) as distance
      FROM deso_areas
      ORDER BY distance ASC
      LIMIT 1`,
      [JSON.stringify(polygon)]
    );

    if (result.rows.length === 0) {
      throw new Error('No DeSO areas found in database');
    }

    const nearest = result.rows[0];

    return {
      deso_codes: [nearest.deso_code],
      coverage_percentage: 0,
      fallback_kommun: nearest.kommun_code,
      warnings: [
        'Polygon korsar inga DeSO-områden',
        `Använder närmaste DeSO: ${nearest.kommun_name || nearest.kommun_code}`
      ]
    };
  } catch (error: any) {
    console.error('[Geo] Fallback failed:', error);
    throw new Error(`Fallback to nearest kommun failed: ${error.message}`);
  }
}

/**
 * Get DeSO area details
 */
export async function getDeSoDetails(desoCodes: string[]): Promise<DeSoArea[]> {
  try {
    const placeholders = desoCodes.map((_, i) => `$${i + 1}`).join(',');

    const result = await query(
      `SELECT
        deso_code,
        name,
        kommun_code,
        kommun_name,
        lan_code,
        lan_name,
        category,
        population
      FROM deso_areas
      WHERE deso_code IN (${placeholders})`,
      desoCodes
    );

    return result.rows as DeSoArea[];
  } catch (error: any) {
    console.error('[Geo] Error getting DeSO details:', error);
    throw new Error(`Failed to get DeSO details: ${error.message}`);
  }
}

/**
 * Get all DeSO areas for a kommun
 */
export async function getDeSoByKommun(kommunCode: string): Promise<string[]> {
  try {
    const result = await query(
      `SELECT deso_code
       FROM deso_areas
       WHERE kommun_code = $1
       ORDER BY deso_code`,
      [kommunCode]
    );

    return result.rows.map(row => row.deso_code);
  } catch (error: any) {
    console.error('[Geo] Error getting DeSO by kommun:', error);
    throw new Error(`Failed to get DeSO by kommun: ${error.message}`);
  }
}

/**
 * Get DeSO boundaries as GeoJSON for map overlay
 */
export async function getDeSoBoundariesGeoJSON(desoCodes: string[]) {
  try {
    const placeholders = desoCodes.map((_, i) => `$${i + 1}`).join(',');

    const result = await query(
      `SELECT
        deso_code,
        name,
        ST_AsGeoJSON(geom) as geometry
      FROM deso_areas
      WHERE deso_code IN (${placeholders})`,
      desoCodes
    );

    const features = result.rows.map(row => ({
      type: 'Feature',
      properties: {
        deso_code: row.deso_code,
        name: row.name
      },
      geometry: JSON.parse(row.geometry)
    }));

    return {
      type: 'FeatureCollection',
      features
    };
  } catch (error: any) {
    console.error('[Geo] Error getting DeSO boundaries:', error);
    throw new Error(`Failed to get DeSO boundaries: ${error.message}`);
  }
}

/**
 * Get kommun boundaries as GeoJSON
 */
export async function getKommunBoundariesGeoJSON(kommunCode: string) {
  try {
    const result = await query(
      `SELECT
        ST_AsGeoJSON(ST_Union(geom)) as geometry,
        kommun_name,
        kommun_code
      FROM deso_areas
      WHERE kommun_code = $1
      GROUP BY kommun_code, kommun_name`,
      [kommunCode]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      type: 'Feature',
      properties: {
        kommun_code: result.rows[0].kommun_code,
        kommun_name: result.rows[0].kommun_name
      },
      geometry: JSON.parse(result.rows[0].geometry)
    };
  } catch (error: any) {
    console.error('[Geo] Error getting kommun boundaries:', error);
    throw new Error(`Failed to get kommun boundaries: ${error.message}`);
  }
}

/**
 * Aggregate data for multiple DeSO areas
 */
export async function aggregateDeSoData(
  desoCodes: string[],
  metric: string
): Promise<number> {
  try {
    if (desoCodes.length === 0) {
      return 0;
    }

    // Simple aggregation - can be extended with weighted averages based on population
    const placeholders = desoCodes.map((_, i) => `$${i + 2}`).join(',');

    const result = await query(
      `SELECT AVG(value) as avg_value
       FROM scb_time_series
       WHERE metric_type = $1
       AND deso_code IN (${placeholders})
       AND time_period = (SELECT MAX(time_period) FROM scb_time_series WHERE metric_type = $1)`,
      [metric, ...desoCodes]
    );

    return parseFloat(result.rows[0]?.avg_value || '0');
  } catch (error: any) {
    console.error('[Geo] Error aggregating DeSO data:', error);
    return 0;
  }
}

export default {
  findDeSoByPolygon,
  getDeSoDetails,
  getDeSoByKommun,
  getDeSoBoundariesGeoJSON,
  getKommunBoundariesGeoJSON,
  aggregateDeSoData
};
