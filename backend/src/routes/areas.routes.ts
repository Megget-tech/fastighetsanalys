import { Router, Request, Response } from 'express';
import {
  findDeSoByPolygon,
  getDeSoDetails,
  getDeSoBoundariesGeoJSON,
  getKommunBoundariesGeoJSON
} from '../services/geo.service';
import { FindDeSoRequest, FindDeSoResponse } from '../models/types';

const router = Router();

/**
 * POST /api/areas/find-deso
 * Find DeSO areas that intersect with a polygon
 */
router.post('/find-deso', async (req: Request, res: Response) => {
  try {
    const { polygon } = req.body as FindDeSoRequest;

    if (!polygon || polygon.type !== 'Polygon') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Polygon is required and must be of type "Polygon"'
      });
    }

    console.log('[API] Finding DeSO areas for polygon...');

    // Find matching DeSO areas
    const matchResult = await findDeSoByPolygon(polygon);

    if (matchResult.deso_codes.length === 0) {
      return res.status(404).json({
        error: 'No DeSO areas found',
        message: 'No DeSO areas intersect with the provided polygon'
      });
    }

    // Get details for matched areas
    const desoDetails = await getDeSoDetails(matchResult.deso_codes);

    const response: FindDeSoResponse = {
      deso_codes: matchResult.deso_codes,
      deso_names: desoDetails.map(d => d.name),
      kommun_code: matchResult.fallback_kommun || desoDetails[0]?.kommun_code || '',
      kommun_name: desoDetails[0]?.kommun_name || '',
      coverage_percentage: matchResult.coverage_percentage,
      warnings: matchResult.warnings
    };

    res.json(response);
  } catch (error: any) {
    console.error('[API] Error in /find-deso:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/areas/deso/:desoCode
 * Get details for a specific DeSO area
 */
router.get('/deso/:desoCode', async (req: Request, res: Response) => {
  try {
    const { desoCode } = req.params;

    const details = await getDeSoDetails([desoCode]);

    if (details.length === 0) {
      return res.status(404).json({
        error: 'DeSO not found',
        message: `No DeSO area found with code: ${desoCode}`
      });
    }

    res.json(details[0]);
  } catch (error: any) {
    console.error('[API] Error in /deso/:desoCode:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/areas/boundaries/deso
 * Get DeSO boundaries as GeoJSON for map overlay
 */
router.get('/boundaries/deso', async (req: Request, res: Response) => {
  try {
    const { codes } = req.query;

    if (!codes) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Query parameter "codes" is required (comma-separated DeSO codes)'
      });
    }

    const desoCodes = (codes as string).split(',');
    const geojson = await getDeSoBoundariesGeoJSON(desoCodes);

    res.json(geojson);
  } catch (error: any) {
    console.error('[API] Error in /boundaries/deso:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/areas/boundaries/kommun/:kommunCode
 * Get kommun boundaries as GeoJSON
 */
router.get('/boundaries/kommun/:kommunCode', async (req: Request, res: Response) => {
  try {
    const { kommunCode } = req.params;

    const geojson = await getKommunBoundariesGeoJSON(kommunCode);

    if (!geojson) {
      return res.status(404).json({
        error: 'Kommun not found',
        message: `No kommun found with code: ${kommunCode}`
      });
    }

    res.json(geojson);
  } catch (error: any) {
    console.error('[API] Error in /boundaries/kommun:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;
