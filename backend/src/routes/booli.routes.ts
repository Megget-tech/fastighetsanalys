import express, { Request, Response } from 'express';
import multer from 'multer';
import {
  parseSoldPropertiesFile,
  parseMarketTrendsFile,
  clearBooliData,
  saveSoldProperties,
  saveMarketTrends,
  getSoldProperties,
  getMarketTrends,
  getStatisticsSummary
} from '../services/booli.service';

const router = express.Router();

// Configure multer for file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept Excel files (xlsx, xls) and also octet-stream (sometimes sent by browsers/curl)
    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream'
    ];

    const isValidExtension = file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls');

    if (validMimeTypes.includes(file.mimetype) || isValidExtension) {
      cb(null, true);
    } else {
      cb(new Error(`Only Excel files (.xlsx, .xls) are allowed. Got: ${file.mimetype}`));
    }
  }
});

/**
 * Upload Booli data files
 * Expects 4 files:
 * - soldNew: Sålda nyproduktion
 * - soldOld: Sålda succession
 * - trendsNew: Utbud nyproduktion
 * - trendsOld: Utbud succession
 */
router.post('/upload', upload.fields([
  { name: 'soldNew', maxCount: 1 },
  { name: 'soldOld', maxCount: 1 },
  { name: 'trendsNew', maxCount: 1 },
  { name: 'trendsOld', maxCount: 1 }
]), async (req: Request, res: Response) => {
  try {
    console.log('[Booli Upload] Processing uploaded files...');

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Validate all 4 files are present
    if (!files.soldNew || !files.soldOld || !files.trendsNew || !files.trendsOld) {
      return res.status(400).json({
        error: 'All 4 files are required: soldNew, soldOld, trendsNew, trendsOld'
      });
    }

    // Get region from request body (default to "Umeå")
    const region = req.body.region || 'Umeå';

    // Clear existing data
    await clearBooliData();

    // Parse and save sold properties - Nyproduktion
    console.log('[Booli Upload] Parsing sold nyproduktion...');
    const soldNewData = await parseSoldPropertiesFile(files.soldNew[0].buffer, 'nyproduktion');
    await saveSoldProperties(soldNewData);

    // Parse and save sold properties - Succession
    console.log('[Booli Upload] Parsing sold succession...');
    const soldOldData = await parseSoldPropertiesFile(files.soldOld[0].buffer, 'succession');
    await saveSoldProperties(soldOldData);

    // Parse and save market trends - Nyproduktion
    console.log('[Booli Upload] Parsing trends nyproduktion...');
    const trendsNewData = await parseMarketTrendsFile(
      files.trendsNew[0].buffer,
      'nyproduktion',
      region
    );
    await saveMarketTrends(trendsNewData);

    // Parse and save market trends - Succession
    console.log('[Booli Upload] Parsing trends succession...');
    const trendsOldData = await parseMarketTrendsFile(
      files.trendsOld[0].buffer,
      'succession',
      region
    );
    await saveMarketTrends(trendsOldData);

    // Get summary statistics
    const summary = await getStatisticsSummary();

    console.log('[Booli Upload] Upload complete!');

    res.json({
      success: true,
      message: 'Booli data uploaded successfully',
      summary: {
        soldNewCount: soldNewData.length,
        soldOldCount: soldOldData.length,
        trendsNewCount: trendsNewData.length,
        trendsOldCount: trendsOldData.length,
        region,
        statistics: summary
      }
    });

  } catch (error: any) {
    console.error('[Booli Upload] Error:', error);
    res.status(500).json({
      error: 'Failed to upload Booli data',
      message: error.message
    });
  }
});

/**
 * Get all sold properties
 */
router.get('/sales', async (req: Request, res: Response) => {
  try {
    const sales = await getSoldProperties();

    res.json({
      success: true,
      count: sales.length,
      data: sales
    });

  } catch (error: any) {
    console.error('[Booli] Error fetching sales:', error);
    res.status(500).json({
      error: 'Failed to fetch sold properties',
      message: error.message
    });
  }
});

/**
 * Get market trends
 */
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const trends = await getMarketTrends();

    res.json({
      success: true,
      count: trends.length,
      data: trends
    });

  } catch (error: any) {
    console.error('[Booli] Error fetching trends:', error);
    res.status(500).json({
      error: 'Failed to fetch market trends',
      message: error.message
    });
  }
});

/**
 * Get statistics summary
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = await getStatisticsSummary();

    res.json({
      success: true,
      data: summary
    });

  } catch (error: any) {
    console.error('[Booli] Error fetching summary:', error);
    res.status(500).json({
      error: 'Failed to fetch summary',
      message: error.message
    });
  }
});

/**
 * Clear all Booli data
 */
router.delete('/clear', async (req: Request, res: Response) => {
  try {
    await clearBooliData();

    res.json({
      success: true,
      message: 'All Booli data cleared'
    });

  } catch (error: any) {
    console.error('[Booli] Error clearing data:', error);
    res.status(500).json({
      error: 'Failed to clear data',
      message: error.message
    });
  }
});

export default router;
