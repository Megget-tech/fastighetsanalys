import axios from 'axios';

// Registerbeteckning Direkt API
const REGBET_BASE_URL = process.env.REGBET_API_URL || 'https://api.lantmateriet.se/distribution/produkter/registerbeteckning/v5';
const REGBET_CONSUMER_KEY = process.env.REGBET_CONSUMER_KEY || '';
const REGBET_CONSUMER_SECRET = process.env.REGBET_CONSUMER_SECRET || '';
const REGBET_SCOPE = 'registerbeteckning_direkt_v5_read';

// Token cache (in-memory)
let regbetTokenCache: { token: string; expires: number } | null = null;

/**
 * Get OAuth2 access token for Registerbeteckning Direkt API
 */
async function getRegbetAccessToken(): Promise<string> {
  // Check cache
  if (regbetTokenCache && regbetTokenCache.expires > Date.now()) {
    console.log('[Registerbeteckning] Using cached access token');
    return regbetTokenCache.token;
  }

  if (!REGBET_CONSUMER_KEY || !REGBET_CONSUMER_SECRET) {
    throw new Error('Registerbeteckning credentials not configured. Set REGBET_CONSUMER_KEY and REGBET_CONSUMER_SECRET in .env');
  }

  console.log('[Registerbeteckning] Fetching new OAuth2 access token...');

  try {
    const tokenUrl = 'https://apimanager.lantmateriet.se/oauth2/token';

    const response = await axios.post(
      tokenUrl,
      new URLSearchParams({
        grant_type: 'client_credentials',
        scope: REGBET_SCOPE
      }),
      {
        auth: {
          username: REGBET_CONSUMER_KEY,
          password: REGBET_CONSUMER_SECRET
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );

    const { access_token, expires_in } = response.data;

    // Cache token (expires_in is in seconds, subtract 60s for safety margin)
    regbetTokenCache = {
      token: access_token,
      expires: Date.now() + (expires_in - 60) * 1000
    };

    console.log(`[Registerbeteckning] Access token obtained, expires in ${expires_in}s`);

    return access_token;

  } catch (error: any) {
    console.error('[Registerbeteckning] Failed to get access token:', error.message);
    if (error.response) {
      console.error('[Registerbeteckning] Token response:', error.response.data);
    }
    throw new Error(`Failed to authenticate with Registerbeteckning Direkt: ${error.message}`);
  }
}

// Response types
interface RegisterbeteckningResponse {
  objektidentitet: string;
  beteckning: string;
  status?: string;
  kommun?: string;
  trakt?: string;
  block?: string;
  enhet?: string;
  centerCoords?: [number, number];
}

/**
 * Search for property by name (fastighetsbeteckning)
 * Uses Lantmäteriet's Registerbeteckning Direkt API with OAuth2
 *
 * @param namn - Property designation, e.g. "UMEÅ TOLVMANSGÅRDEN 4" or "STOCKHOLM KUNGSHOLMEN 1:1"
 * @returns Property reference with objektidentitet (UUID)
 */
export async function searchPropertyByName(namn: string): Promise<RegisterbeteckningResponse | null> {
  if (!REGBET_CONSUMER_KEY || !REGBET_CONSUMER_SECRET) {
    console.warn('[Registerbeteckning] API credentials not configured. Set REGBET_CONSUMER_KEY and REGBET_CONSUMER_SECRET in .env');
    return null;
  }

  try {
    console.log(`[Registerbeteckning] Searching for: ${namn}`);

    // Get OAuth2 access token
    const accessToken = await getRegbetAccessToken();

    // URL encode the namn parameter manually to handle Swedish characters correctly
    const encodedNamn = encodeURIComponent(namn);
    const url = `${REGBET_BASE_URL}/namn?namn=${encodedNamn}&srid=3006`;

    console.log(`[Registerbeteckning] Request URL: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    console.log(`[Registerbeteckning] Response status: ${response.status}`);
    console.log(`[Registerbeteckning] Response data (first 1500 chars):`, JSON.stringify(response.data).substring(0, 1500));

    // Response is a FeatureCollection (GeoJSON format)
    const geojson = response.data;

    // Also log if geometry exists in the feature
    if (geojson.features && geojson.features[0]) {
      console.log(`[Registerbeteckning] Feature geometry type:`, geojson.features[0].geometry?.type || 'null');
      console.log(`[Registerbeteckning] Feature has geometry:`, !!geojson.features[0].geometry);
    }

    if (!geojson || !geojson.features || geojson.features.length === 0) {
      console.log(`[Registerbeteckning] No properties found for: ${namn}`);
      return null;
    }

    // Extract property info from first feature
    const feature = geojson.features[0];
    const props = feature.properties;
    const registerbeteckning = props.registerbeteckning?.[0];

    if (!registerbeteckning) {
      console.log(`[Registerbeteckning] No registerbeteckning in response for: ${namn}`);
      return null;
    }

    // Extract central point coordinates if available
    const centralPoint = props.registerenhetsreferens?.registerenhetsomrade?.[0]?.centralpunktskoordinat;
    let centerCoords: [number, number] | undefined;

    if (centralPoint && centralPoint.coordinates && centralPoint.coordinates.length === 2) {
      centerCoords = [centralPoint.coordinates[0], centralPoint.coordinates[1]];
      console.log(`[Registerbeteckning] Found central point: [${centerCoords[0]}, ${centerCoords[1]}]`);
    }

    // Construct result from GeoJSON response
    const results = [{
      objektidentitet: props.registerenhetsreferens?.objektidentitet,
      beteckning: `${registerbeteckning.registeromrade} ${registerbeteckning.trakt || ''} ${registerbeteckning.block || ''}${registerbeteckning.enhet ? ':' + registerbeteckning.enhet : ''}`.trim(),
      kommun: registerbeteckning.registeromrade,
      trakt: registerbeteckning.trakt,
      block: registerbeteckning.block?.toString(),
      enhet: registerbeteckning.enhet?.toString(),
      status: registerbeteckning.beteckningsstatus,
      centerCoords: centerCoords
    }];

    if (results.length === 0) {
      console.log(`[Registerbeteckning] No valid properties in response for: ${namn}`);
      return null;
    }

    // Take first match
    const property = results[0];

    console.log(`[Registerbeteckning] Found property: ${property.beteckning || namn} (${property.objektidentitet})`);

    return {
      objektidentitet: property.objektidentitet,
      beteckning: property.beteckning || namn,
      status: property.status,
      kommun: property.kommun,
      trakt: property.trakt,
      block: property.block,
      enhet: property.enhet,
      centerCoords: property.centerCoords
    };

  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`[Registerbeteckning] Property not found: ${namn}`);
      return null;
    }

    if (error.response?.status === 401) {
      console.error(`[Registerbeteckning] Authentication failed. Check credentials.`);
      throw new Error('Authentication failed with Registerbeteckning Direkt API');
    }

    console.error(`[Registerbeteckning] Error searching property:`, error.message);

    if (error.response) {
      console.error(`[Registerbeteckning] Response status:`, error.response.status);
      console.error(`[Registerbeteckning] Response data:`, JSON.stringify(error.response.data).substring(0, 200));
    }

    throw new Error(`Failed to search property in Registerbeteckning Direkt: ${error.message}`);
  }
}

/**
 * Get property by objektidentitet (UUID)
 *
 * @param objektidentitet - UUID of the property
 * @returns Property reference
 */
export async function getPropertyById(objektidentitet: string): Promise<RegisterbeteckningResponse | null> {
  if (!REGBET_CONSUMER_KEY || !REGBET_CONSUMER_SECRET) {
    console.warn('[Registerbeteckning] API credentials not configured');
    return null;
  }

  try {
    console.log(`[Registerbeteckning] Fetching property by ID: ${objektidentitet}`);

    // Get OAuth2 access token
    const accessToken = await getRegbetAccessToken();

    const url = `${REGBET_BASE_URL}/${objektidentitet}`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const property = response.data;

    return {
      objektidentitet: property.objektidentitet,
      beteckning: property.beteckning,
      status: property.status,
      kommun: property.kommun,
      trakt: property.trakt,
      block: property.block,
      enhet: property.enhet
    };

  } catch (error: any) {
    console.error(`[Registerbeteckning] Error fetching property by ID:`, error.message);
    throw error;
  }
}

export default {
  searchPropertyByName,
  getPropertyById
};
