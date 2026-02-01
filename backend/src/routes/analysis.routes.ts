import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { runQuickAnalysis, runFullAnalysis, AnalysisInput, FullAnalysisResult } from '../services/analysis.service';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    // Ensure upload directory exists
    fs.mkdir(uploadDir, { recursive: true }).then(() => {
      cb(null, uploadDir);
    }).catch(err => {
      cb(err, uploadDir);
    });
  },
  filename: (req, file, cb) => {
    // Keep original filename with timestamp prefix
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}-${safeName}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Accept Excel and CSV files
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
      'application/csv'
    ];
    const allowedExts = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

/**
 * POST /api/analysis/quick
 * Run quick analysis on collected data
 *
 * Body (multipart/form-data):
 * - inputData: JSON string with analysis input
 * - nyproduktionFile: Optional Excel/CSV file
 */
router.post('/quick', upload.single('nyproduktionFile'), async (req: Request, res: Response) => {
  try {
    console.log('[API] Quick analysis request received');

    // Parse inputData from request body
    let inputData: AnalysisInput;
    try {
      inputData = typeof req.body.inputData === 'string'
        ? JSON.parse(req.body.inputData)
        : req.body.inputData;
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid inputData JSON'
      });
    }

    if (!inputData || !inputData.metrics) {
      return res.status(400).json({
        success: false,
        error: 'inputData with metrics is required'
      });
    }

    // Get nyproduktion file path if uploaded
    const nyproduktionFilePath = req.file?.path || undefined;

    console.log('[API] Starting quick analysis...');
    console.log('[API] Kommun:', inputData.kommun_name);
    console.log('[API] DeSO codes:', inputData.deso_codes?.join(', '));
    console.log('[API] Nyproduktion file:', nyproduktionFilePath || 'none');

    const result = await runQuickAnalysis(inputData, nyproduktionFilePath);

    if (result.success) {
      res.json({
        success: true,
        recommendation: result.summary.recommendation,
        confidence: result.summary.confidence,
        rationale: result.summary.rationale,
        files: {
          pdf: result.files.pdf,
          map: result.files.map,
          json: result.files.json
        },
        // Include analysis details for frontend display
        marketAnalysis: result.fullResults?.quick_market_output?.output,
        locationAnalysis: result.fullResults?.quick_location_output?.output,
        synthesis: result.fullResults?.quick_synthesis_output?.output
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.summary.error || 'Analysis failed',
        rationale: result.summary.rationale
      });
    }

  } catch (error: any) {
    console.error('[API] Quick analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/analysis/full
 * Run full analysis on collected data
 * Note: This takes 5-15 minutes to complete
 *
 * Body (multipart/form-data):
 * - inputData: JSON string with analysis input
 * - nyproduktionFile: Optional Excel/CSV file
 */
router.post('/full', upload.single('nyproduktionFile'), async (req: Request, res: Response) => {
  try {
    console.log('[API] Full analysis request received');

    // Parse inputData from request body
    let inputData: AnalysisInput;
    try {
      inputData = typeof req.body.inputData === 'string'
        ? JSON.parse(req.body.inputData)
        : req.body.inputData;
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid inputData JSON'
      });
    }

    if (!inputData || !inputData.metrics) {
      return res.status(400).json({
        success: false,
        error: 'inputData with metrics is required'
      });
    }

    // Get nyproduktion file path if uploaded
    const nyproduktionFilePath = req.file?.path || undefined;

    console.log('[API] Starting full analysis (this may take 5-15 minutes)...');
    console.log('[API] Kommun:', inputData.kommun_name);
    console.log('[API] DeSO codes:', inputData.deso_codes?.join(', '));
    console.log('[API] Nyproduktion file:', nyproduktionFilePath || 'none');

    const result = await runFullAnalysis(inputData, nyproduktionFilePath);

    if (result.success) {
      res.json({
        success: true,
        recommendation: result.summary.recommendation,
        confidence: result.summary.confidence,
        rationale: result.summary.rationale,
        qaDecision: result.summary.qaDecision,
        keyRecommendations: result.summary.keyRecommendations,
        files: {
          pdf: result.files.pdf,
          executivePdf: result.files.executivePdf,
          map: result.files.map,
          json: result.files.json
        },
        // Include analysis details for frontend display
        fullResults: result.fullResults
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.summary.error || 'Full analysis failed',
        rationale: result.summary.rationale
      });
    }

  } catch (error: any) {
    console.error('[API] Full analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/analysis/files/:filename
 * Serve generated analysis files (PDF, etc.)
 */
router.get('/files/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({ error: 'File path required' });
    }

    // Security: Only allow serving files from temp directories
    // macOS uses /var/folders/, Linux uses /tmp/, Windows uses \temp\
    const isInTempDir = filePath.includes('/tmp/') ||
                        filePath.includes('/var/folders/') ||
                        filePath.includes('\\temp\\');
    if (!isInTempDir) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }

    // Determine content type
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.html': 'text/html'
    };

    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    const fileBuffer = await fs.readFile(filePath);
    res.send(fileBuffer);

  } catch (error: any) {
    console.error('[API] File serve error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
