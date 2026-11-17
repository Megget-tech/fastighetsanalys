import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { runQuickAnalysis, runFullAnalysis, AnalysisInput } from '../services/analysis.service';
import { startJob, getJob, canStartJob } from '../services/analysis-jobs.service';

const router = Router();

// Uppladdade nyproduktionsfiler behövs bara under analysen: de läggs i temp och tas bort med jobbet
const UPLOAD_DIR = path.join(os.tmpdir(), 'fdata-uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(UPLOAD_DIR, { recursive: true }).then(() => {
      cb(null, UPLOAD_DIR);
    }).catch(err => {
      cb(err, UPLOAD_DIR);
    });
  },
  filename: (req, file, cb) => {
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

function parseInput(req: Request): AnalysisInput | string {
  let inputData: AnalysisInput;
  try {
    inputData = typeof req.body.inputData === 'string'
      ? JSON.parse(req.body.inputData)
      : req.body.inputData;
  } catch (e) {
    return 'Invalid inputData JSON';
  }
  if (!inputData || !inputData.metrics) {
    return 'inputData with metrics is required';
  }
  return inputData;
}

/** Filerna ett jobb får servera, som URL:er relativt API:t (frontend lägger på API_URL). */
function fileUrls(jobId: string, files: Record<string, string>) {
  const urls: Record<string, string> = {};
  for (const key of Object.keys(files)) urls[key] = `/analysis/jobs/${jobId}/files/${key}`;
  return urls;
}

function existing(files: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(files)) if (v) out[k] = v;
  return out;
}

/**
 * POST /api/analysis/quick
 * Startar en snabbanalys i bakgrunden. Svar 202 { jobId }; följ upp med GET /api/analysis/jobs/:id.
 *
 * Body (multipart/form-data):
 * - inputData: JSON string with analysis input
 * - nyproduktionFile: Optional Excel/CSV file
 */
router.post('/quick', upload.single('nyproduktionFile'), async (req: Request, res: Response) => {
  const uploaded = req.file?.path;
  const input = parseInput(req);
  if (typeof input === 'string') {
    if (uploaded) await fs.rm(uploaded, { force: true });
    return res.status(400).json({ success: false, error: input });
  }
  if (!canStartJob()) {
    if (uploaded) await fs.rm(uploaded, { force: true });
    return res.status(429).json({ success: false, error: 'För många analyser pågår just nu. Försök igen om en stund.' });
  }

  console.log('[API] Quick analysis job:', input.kommun_name, input.deso_codes?.join(', '), uploaded ? '(med nyproduktion)' : '');

  const job = startJob('quick', async () => {
    const result = await runQuickAnalysis(input, uploaded);
    const files = existing({ pdf: result.files.pdf, map: result.files.map, json: result.files.json });
    const cleanup = result.tempDir ? [result.tempDir] : [];
    if (!result.success) {
      return {
        ok: false,
        files: {},
        cleanup,
        error: result.summary.error || 'Analysis failed',
        result: { success: false, error: result.summary.error || 'Analysis failed', rationale: result.summary.rationale },
      };
    }
    return {
      ok: true,
      files,
      cleanup,
      result: {
        success: true,
        recommendation: result.summary.recommendation,
        confidence: result.summary.confidence,
        rationale: result.summary.rationale,
        files: fileUrls(job.id, files),
        marketAnalysis: result.fullResults?.quick_market_output?.output,
        locationAnalysis: result.fullResults?.quick_location_output?.output,
        synthesis: result.fullResults?.quick_synthesis_output?.output,
      },
    };
  }, uploaded ? [uploaded] : []);

  res.status(202).json({ success: true, jobId: job.id });
});

/**
 * POST /api/analysis/full
 * Startar en fullständig analys (5–15 minuter) i bakgrunden. Svar 202 { jobId }.
 */
router.post('/full', upload.single('nyproduktionFile'), async (req: Request, res: Response) => {
  const uploaded = req.file?.path;
  const input = parseInput(req);
  if (typeof input === 'string') {
    if (uploaded) await fs.rm(uploaded, { force: true });
    return res.status(400).json({ success: false, error: input });
  }
  if (!canStartJob()) {
    if (uploaded) await fs.rm(uploaded, { force: true });
    return res.status(429).json({ success: false, error: 'För många analyser pågår just nu. Försök igen om en stund.' });
  }

  console.log('[API] Full analysis job:', input.kommun_name, input.deso_codes?.join(', '), uploaded ? '(med nyproduktion)' : '');

  const job = startJob('full', async () => {
    const result = await runFullAnalysis(input, uploaded);
    const cleanup = result.tempDir ? [result.tempDir] : [];
    if (!result.success) {
      return {
        ok: false,
        files: {},
        cleanup,
        error: result.summary.error || 'Full analysis failed',
        result: { success: false, error: result.summary.error || 'Full analysis failed', rationale: result.summary.rationale },
      };
    }
    // Bara filer som faktiskt skapades
    const candidates = existing({
      pdf: result.files.pdf,
      executivePdf: result.files.executivePdf,
      map: result.files.map,
      json: result.files.json,
    });
    const files: Record<string, string> = {};
    for (const [k, p] of Object.entries(candidates)) {
      if (await fs.access(p).then(() => true, () => false)) files[k] = p;
    }
    return {
      ok: true,
      files,
      cleanup,
      result: {
        success: true,
        recommendation: result.summary.recommendation,
        confidence: result.summary.confidence,
        rationale: result.summary.rationale,
        qaDecision: result.summary.qaDecision,
        keyRecommendations: result.summary.keyRecommendations,
        files: fileUrls(job.id, files),
        fullResults: result.fullResults,
      },
    };
  }, uploaded ? [uploaded] : []);

  res.status(202).json({ success: true, jobId: job.id });
});

/**
 * GET /api/analysis/jobs/:id
 * Status för ett analysjobb: { status: 'running' | 'done' | 'error', elapsedSeconds, result? }
 */
router.get('/jobs/:id', (req: Request, res: Response) => {
  const job = getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Analysjobbet finns inte (tjänsten kan ha startats om).' });
  }
  res.json({
    id: job.id,
    kind: job.kind,
    status: job.status,
    elapsedSeconds: Math.round(((job.finishedAt || Date.now()) - job.startedAt) / 1000),
    result: job.result,
    error: job.error,
  });
});

/**
 * GET /api/analysis/jobs/:id/files/:key
 * Serverar en fil som jobbet skapat (pdf, executivePdf, map, json). Bara jobbets egna filer kan hämtas.
 */
router.get('/jobs/:id/files/:key', async (req: Request, res: Response) => {
  const job = getJob(req.params.id);
  const filePath = job?.files[req.params.key];
  if (!job || !filePath) {
    return res.status(404).json({ error: 'File not found' });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
  };
  const filename = typeof req.query.name === 'string'
    ? req.query.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    : path.basename(filePath);

  try {
    const fileBuffer = await fs.readFile(filePath);
    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(fileBuffer);
  } catch {
    res.status(404).json({ error: 'File not found' });
  }
});

export default router;
