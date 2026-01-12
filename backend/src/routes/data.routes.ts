import { Router, Request, Response } from 'express';
import {
  getAllMetrics,
  getAggregatedMetrics,
  getTimeSeries,
  getKommunMetrics,
  getRiketMetrics
} from '../services/scb.service';
import { getBooliMetrics } from '../services/booli-mock.service';
import { getDeSoDetails } from '../services/geo.service';
import { GetMetricsResponse, GetTimeSeriesResponse } from '../models/types';

const router = Router();

/**
 * GET /api/data/metrics/:desoCode
 * Get all metrics for a DeSO area
 */
router.get('/metrics/:desoCode', async (req: Request, res: Response) => {
  try {
    const { desoCode } = req.params;

    console.log(`[API] Fetching metrics for DeSO ${desoCode}...`);

    // Get DeSO details
    const desoDetails = await getDeSoDetails([desoCode]);

    if (desoDetails.length === 0) {
      return res.status(404).json({
        error: 'DeSO not found',
        message: `No DeSO area found with code: ${desoCode}`
      });
    }

    const deso = desoDetails[0];

    // Fetch all metrics in parallel
    const [scbMetrics, booliMetrics] = await Promise.all([
      getAllMetrics(desoCode, deso.kommun_code),
      getBooliMetrics(desoCode)
    ]);

    const response: GetMetricsResponse = {
      deso_code: desoCode,
      deso_name: deso.name,
      kommun_name: deso.kommun_name,
      metrics: {
        income: scbMetrics.income,
        population: scbMetrics.population,
        education: scbMetrics.education,
        migration: scbMetrics.migration,
        origin: scbMetrics.origin,
        household: scbMetrics.household,
        housing_type: scbMetrics.housing_type,
        tenure_form: scbMetrics.tenure_form,
        economic_standard: scbMetrics.economic_standard,
        earned_income: scbMetrics.earned_income,
        booli: booliMetrics
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('[API] Error in /metrics/:desoCode:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/data/metrics/aggregated
 * Get aggregated metrics for multiple DeSO areas
 */
router.post('/metrics/aggregated', async (req: Request, res: Response) => {
  try {
    const { deso_codes } = req.body;

    if (!deso_codes || !Array.isArray(deso_codes) || deso_codes.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'deso_codes array is required and must not be empty'
      });
    }

    console.log(`[API] Fetching aggregated metrics for ${deso_codes.length} DeSO areas`);

    const aggregatedData = await getAggregatedMetrics(deso_codes);

    res.json(aggregatedData);
  } catch (error: any) {
    console.error('[API] Error in /metrics/aggregated:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/data/timeseries/:desoCode/:metric
 * Get time series data for a specific metric
 */
router.get('/timeseries/:desoCode/:metric', async (req: Request, res: Response) => {
  try {
    const { desoCode, metric } = req.params;

    const validMetrics = ['income', 'population', 'education'];

    if (!validMetrics.includes(metric)) {
      return res.status(400).json({
        error: 'Invalid metric',
        message: `Metric must be one of: ${validMetrics.join(', ')}`
      });
    }

    console.log(`[API] Fetching time series for DeSO ${desoCode}, metric: ${metric}`);

    const desoData = await getTimeSeries(
      desoCode,
      metric as 'income' | 'population' | 'education'
    );

    const response: GetTimeSeriesResponse = {
      metric_type: metric,
      metric_name: desoData.metric_name,
      unit: desoData.unit,
      deso_data: desoData.data
    };

    res.json(response);
  } catch (error: any) {
    console.error('[API] Error in /timeseries/:desoCode/:metric:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/data/kommun/:kommunCode
 * Get kommun-level metrics
 */
router.get('/kommun/:kommunCode', async (req: Request, res: Response) => {
  try {
    const { kommunCode } = req.params;

    console.log(`[API] Fetching kommun metrics for ${kommunCode}`);

    const metrics = await getKommunMetrics(kommunCode);

    res.json(metrics);
  } catch (error: any) {
    console.error('[API] Error in /kommun/:kommunCode:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/data/riket
 * Get Sweden-wide metrics for comparison
 */
router.get('/riket', async (req: Request, res: Response) => {
  try {
    console.log('[API] Fetching riket metrics');

    const metrics = await getRiketMetrics();

    res.json(metrics);
  } catch (error: any) {
    console.error('[API] Error in /riket:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;
