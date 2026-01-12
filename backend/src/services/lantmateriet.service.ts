import axios from 'axios';
import proj4 from 'proj4';
import { getCachedOrFetch, generateCacheKey } from './cache.service';
import { searchPropertyByName } from './registerbeteckning.service';

// Lantmäteriet OGC Features API
const LM_OGC_BASE_URL = process.env.LM_OGC_URL || 'https://api.lantmateriet.se/ogc-features/v1/fastighetsindelning';
const LM_CONSUMER_KEY = process.env.LM_CONSUMER_KEY || '';
const LM_CONSUMER_SECRET = process.env.LM_CONSUMER_SECRET || '';
const LM_SCOPE = 'ogc-features:fastighetsindelning.read';

// Define coordinate systems for conversion
// SWEREF99 TM (EPSG:3006)
proj4.defs('EPSG:3006', '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
// WGS84 (EPSG:4326) is built-in to proj4

// Token cache (in-memory för enkelhetens skull)
let accessTokenCache: { token: string; expires: number } | null = null;

/**
 * Get OAuth access token from Lantmäteriet
 * Uses consumer key and secret to obtain a token with required scope
 */
async function getAccessToken(): Promise<string> {
  // Check cache
  if (accessTokenCache && accessTokenCache.expires > Date.now()) {
    console.log('[Lantmäteriet] Using cached access token');
    return accessTokenCache.token;
  }

  if (!LM_CONSUMER_KEY || !LM_CONSUMER_SECRET) {
    throw new Error('Lantmäteriet credentials not configured. Set LM_CONSUMER_KEY and LM_CONSUMER_SECRET in .env');
  }

  console.log('[Lantmäteriet] Fetching new access token...');

  try {
    // Lantmäteriet OAuth token endpoint (from API Portal)
    const tokenUrl = 'https://apimanager.lantmateriet.se/oauth2/token';

    const response = await axios.post(
      tokenUrl,
      new URLSearchParams({
        grant_type: 'client_credentials',
        scope: LM_SCOPE
      }),
      {
        auth: {
          username: LM_CONSUMER_KEY,
          password: LM_CONSUMER_SECRET
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );

    const { access_token, expires_in } = response.data;

    // Cache token (expires_in is in seconds, subtract 60s for safety margin)
    accessTokenCache = {
      token: access_token,
      expires: Date.now() + (expires_in - 60) * 1000
    };

    console.log(`[Lantmäteriet] Access token obtained, expires in ${expires_in}s`);

    return access_token;

  } catch (error: any) {
    console.error('[Lantmäteriet] Failed to get access token:', error.message);
    if (error.response) {
      console.error('[Lantmäteriet] Response:', error.response.data);
    }
    throw new Error(`Failed to authenticate with Lantmäteriet: ${error.message}`);
  }
}

interface PropertyGeometry {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'MultiPolygon' | 'Point';
    coordinates: number[][][] | number[][][][] | number[];
  } | null;
  properties: {
    beteckning: string;
    kommun?: string;
    trakt?: string;
    block?: string;
    enhet?: string;
    area_m2?: number;
    objektidentitet?: string;
    geometryType?: string;
  };
}

/**
 * Search for property by fastighetsbeteckning
 * Two-step process:
 * 1. Search in Registerbeteckning Direkt to get objektidentitet
 * 2. Fetch geometry from OGC Features using objektidentitet
 *
 * Supported formats:
 * - "KOMMUN TRAKT BLOCK:ENHET" (e.g., "UMEÅ TOLVMANSGÅRDEN 4:1")
 * - "KOMMUN TRAKT BLOCK" (e.g., "UMEÅ TOLVMANSGÅRDEN 4")
 * - "KOMMUN BLOCK:ENHET" (e.g., "UMEÅ 4:1")
 * - "KOMMUN BLOCK" (e.g., "UMEÅ 4")
 */
export async function searchPropertyByBeteckning(
  beteckning: string
): Promise<PropertyGeometry | null> {
  const cacheKey = generateCacheKey('lantmateriet', `property-${beteckning}`, {});

  return getCachedOrFetch(
    cacheKey,
    'lantmateriet',
    async () => {
      console.log(`[Property Search] Searching for: ${beteckning}`);

      try {
        // STEP 1: Search in Registerbeteckning Direkt
        console.log(`[Property Search] Step 1: Searching Registerbeteckning Direkt...`);
        const propertyRef = await searchPropertyByName(beteckning);

        if (!propertyRef) {
          console.log(`[Property Search] Property not found in Registerbeteckning Direkt: ${beteckning}`);
          return null;
        }

        console.log(`[Property Search] Found property reference: ${propertyRef.beteckning} (${propertyRef.objektidentitet})`);

        // STEP 2: Fetch geometry from OGC Features
        console.log(`[Property Search] Step 2: Fetching geometry from OGC Features...`);

        // If we don't have center coordinates, return without geometry
        if (!propertyRef.centerCoords) {
          console.log(`[Property Search] No center coordinates available, cannot create geometry`);
          return {
            type: 'Feature',
            geometry: null,
            properties: {
              beteckning: propertyRef.beteckning,
              kommun: propertyRef.kommun,
              trakt: propertyRef.trakt,
              block: propertyRef.block,
              enhet: propertyRef.enhet,
              objektidentitet: propertyRef.objektidentitet
            }
          };
        }

        const accessToken = await getAccessToken();
        const url = `${LM_OGC_BASE_URL}/collections/registerenhetsomradesytor/items`;

        // Create a small bounding box around the center point (±100 meters in SWEREF99 TM)
        const [centerX, centerY] = propertyRef.centerCoords;
        const buffer = 100; // 100 meters
        const bbox = [
          centerX - buffer,
          centerY - buffer,
          centerX + buffer,
          centerY + buffer
        ].join(',');

        console.log(`[Property Search] Searching with bbox: ${bbox}`);

        const response = await axios.get(url, {
          params: {
            bbox: bbox,
            'bbox-crs': 'http://www.opengis.net/def/crs/EPSG/0/3006', // SWEREF99 TM
            f: 'json',
            limit: 10 // Get up to 10 features in the area
          },
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/geo+json'
          },
          timeout: 30000
        });

        console.log(`[Property Search] OGC Features response status: ${response.status}`);
        console.log(`[Property Search] OGC Features response:`, JSON.stringify(response.data).substring(0, 500));

        const geojson = response.data;

        if (!geojson.features || geojson.features.length === 0) {
          console.log(`[Property Search] No polygon geometry found in OGC Features`);
          console.log(`[Property Search] Creating Point geometry from center coordinates`);

          // Convert coordinates from SWEREF99 TM (EPSG:3006) to WGS84 (EPSG:4326) for Mapbox
          const [x, y] = propertyRef.centerCoords;
          const [lon, lat] = proj4('EPSG:3006', 'EPSG:4326', [x, y]);

          console.log(`[Property Search] Converted coordinates: SWEREF99 [${x}, ${y}] -> WGS84 [${lon}, ${lat}]`);

          // Return property with Point geometry from center coordinates
          // Coordinates are now in WGS84 (lon, lat)
          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [lon, lat]
            },
            properties: {
              beteckning: propertyRef.beteckning,
              kommun: propertyRef.kommun,
              trakt: propertyRef.trakt,
              block: propertyRef.block,
              enhet: propertyRef.enhet,
              objektidentitet: propertyRef.objektidentitet,
              geometryType: 'point' // Flag to indicate this is a point, not a polygon
            }
          };
        }

        console.log(`[Property Search] Found ${geojson.features.length} features in bbox`);

        // Try to find the exact feature by matching objektidentitet
        let feature = geojson.features.find((f: any) =>
          f.properties?.objektidentitet === propertyRef.objektidentitet
        );

        // If not found by objektidentitet, just take the first feature
        if (!feature) {
          console.log(`[Property Search] Could not match objektidentitet, using first feature`);
          feature = geojson.features[0];
        } else {
          console.log(`[Property Search] Matched feature by objektidentitet`);
        }

        const props = feature.properties;

        console.log(`[Property Search] Successfully fetched geometry for: ${propertyRef.beteckning}`);

        return {
          type: 'Feature',
          geometry: feature.geometry,
          properties: {
            beteckning: propertyRef.beteckning,
            kommun: props.kommunnamn || propertyRef.kommun,
            trakt: props.trakt || propertyRef.trakt,
            block: props.block || propertyRef.block,
            enhet: props.enhet || propertyRef.enhet,
            area_m2: props.areaHa ? props.areaHa * 10000 : undefined,
            objektidentitet: propertyRef.objektidentitet
          }
        };

      } catch (error: any) {
        console.error(`[Property Search] Error:`, error.message);

        if (error.response) {
          console.error(`[Property Search] Response status:`, error.response.status);
          console.error(`[Property Search] Response data:`, JSON.stringify(error.response.data).substring(0, 200));
        }

        throw new Error(`Failed to search property: ${error.message}`);
      }
    },
    86400 // Cache 24h (fastigheter ändras sällan)
  );
}

/**
 * Parse fastighetsbeteckning into components
 * Supported formats:
 * - "KOMMUN TRAKT BLOCK:ENHET" (full format)
 * - "KOMMUN TRAKT BLOCK" (without enhet)
 * - "KOMMUN BLOCK:ENHET" (without trakt)
 * - "KOMMUN BLOCK" (only kommun and block)
 */
export function parseBeteckning(beteckning: string): {
  kommun: string;
  trakt?: string;
  block?: string;
  enhet?: string;
} | null {
  // Remove extra spaces
  const cleaned = beteckning.trim().replace(/\s+/g, ' ');

  // Try full format first: KOMMUN TRAKT BLOCK:ENHET or KOMMUN TRAKT BLOCK
  const fullMatch = cleaned.match(/^([A-ZÅÄÖ\-]+)\s+([A-ZÅÄÖ\-]+)\s+(\d+)(?::(\d+))?$/i);
  if (fullMatch) {
    return {
      kommun: fullMatch[1].toUpperCase(),
      trakt: fullMatch[2].toUpperCase(),
      block: fullMatch[3],
      enhet: fullMatch[4]
    };
  }

  // Try without trakt: KOMMUN BLOCK:ENHET or KOMMUN BLOCK
  const simpleMatch = cleaned.match(/^([A-ZÅÄÖ\-]+)\s+(\d+)(?::(\d+))?$/i);
  if (simpleMatch) {
    return {
      kommun: simpleMatch[1].toUpperCase(),
      trakt: undefined,
      block: simpleMatch[2],
      enhet: simpleMatch[3]
    };
  }

  return null;
}

export default {
  searchPropertyByBeteckning,
  parseBeteckning
};
