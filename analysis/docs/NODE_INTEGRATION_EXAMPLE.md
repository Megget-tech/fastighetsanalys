# Node/Express Integration - Exempel

Detta dokument visar hur du integrerar Python-analysprogrammet med din Node/Express backend.

## 📁 Mappstruktur på servern

```
/var/app/
├── backend/           # Din Node/Express app
│   ├── src/
│   │   ├── routes/
│   │   │   └── analysis.routes.ts
│   │   └── services/
│   │       └── analysis.service.ts
│   └── ...
├── analysis/          # Python-programmet
│   ├── analyze_cli.py
│   └── ...
└── jobs/              # Delad job-mapp
    └── {job-id}/
        ├── input.json
        ├── status.json
        ├── report.pdf
        └── data.json
```

## 🔧 Node/Express Backend Code

### 1. Analysis Service (`services/analysis.service.ts`)

```typescript
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface AnalysisRequest {
  propertyDesignation?: string;
  location?: string;
  reportType: 'quick' | 'full';

  // Data från ditt andra program
  kommun: string;
  deso_codes: string[];
  befolkning?: any;
  inkomst?: any;
  prisanalys?: any;
  // ... etc
}

export interface AnalysisJob {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export class AnalysisService {
  private readonly JOBS_DIR = '/var/app/jobs';
  private readonly PYTHON_CLI = '/var/app/analysis/analyze_cli.py';
  private readonly PYTHON_BIN = 'python3';

  /**
   * Starta en ny analys
   */
  async startAnalysis(request: AnalysisRequest): Promise<{ jobId: string }> {
    const jobId = uuidv4();
    const jobDir = path.join(this.JOBS_DIR, jobId);

    // Skapa job-mapp
    await fs.mkdir(jobDir, { recursive: true });

    // Skriv input.json
    const inputPath = path.join(jobDir, 'input.json');
    await fs.writeFile(
      inputPath,
      JSON.stringify(request, null, 2),
      'utf-8'
    );

    // Initiera status
    await this.updateJobStatus(jobId, {
      jobId,
      status: 'processing',
      progress: 0,
      message: 'I kö...',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Spawna Python-process (non-blocking)
    this.spawnPythonAnalysis(jobId, request.reportType);

    return { jobId };
  }

  /**
   * Spawna Python-process i bakgrunden
   */
  private spawnPythonAnalysis(jobId: string, reportType: 'quick' | 'full'): void {
    const args = [
      this.PYTHON_CLI,
      '--job-id', jobId,
      '--report-type', reportType,
      '--jobs-dir', this.JOBS_DIR
    ];

    // Sätt miljövariabler för API-nycklar
    const env = {
      ...process.env,
      GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
      TRAFIKLAB_API_KEY: process.env.TRAFIKLAB_API_KEY,
      LANTMATERIET_API_KEY: process.env.LANTMATERIET_API_KEY,
      LANTMATERIET_API_SECRET: process.env.LANTMATERIET_API_SECRET,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
    };

    const pythonProcess = spawn(this.PYTHON_BIN, args, {
      detached: true,
      stdio: 'ignore',
      env
    });

    // Låt processen köra i bakgrunden
    pythonProcess.unref();

    console.log(`[${jobId}] Python analysis spawned (PID: ${pythonProcess.pid})`);
  }

  /**
   * Hämta job status
   */
  async getJobStatus(jobId: string): Promise<AnalysisJob | null> {
    const statusPath = path.join(this.JOBS_DIR, jobId, 'status.json');

    try {
      const content = await fs.readFile(statusPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // Job finns inte
      return null;
    }
  }

  /**
   * Hämta rapport-fil
   */
  async getReportPath(jobId: string): Promise<string | null> {
    const reportPath = path.join(this.JOBS_DIR, jobId, 'report.pdf');

    try {
      await fs.access(reportPath);
      return reportPath;
    } catch {
      return null;
    }
  }

  /**
   * Hämta strukturerad data
   */
  async getResultData(jobId: string): Promise<any | null> {
    const dataPath = path.join(this.JOBS_DIR, jobId, 'data.json');

    try {
      const content = await fs.readFile(dataPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Uppdatera job status (intern helper)
   */
  private async updateJobStatus(jobId: string, status: AnalysisJob): Promise<void> {
    const statusPath = path.join(this.JOBS_DIR, jobId, 'status.json');
    await fs.writeFile(statusPath, JSON.stringify(status, null, 2), 'utf-8');
  }

  /**
   * Ta bort gamla jobs (cleanup)
   */
  async cleanupOldJobs(daysOld: number = 7): Promise<number> {
    const jobs = await fs.readdir(this.JOBS_DIR);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let deleted = 0;

    for (const jobId of jobs) {
      const jobDir = path.join(this.JOBS_DIR, jobId);
      const stats = await fs.stat(jobDir);

      if (stats.mtime < cutoffDate) {
        await fs.rm(jobDir, { recursive: true, force: true });
        deleted++;
      }
    }

    return deleted;
  }
}
```

### 2. Analysis Routes (`routes/analysis.routes.ts`)

```typescript
import { Router, Request, Response } from 'express';
import { AnalysisService } from '../services/analysis.service';

const router = Router();
const analysisService = new AnalysisService();

/**
 * POST /api/analysis/start
 * Starta en ny analys
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { jobId } = await analysisService.startAnalysis(req.body);

    res.json({
      success: true,
      jobId,
      message: 'Analys startad',
      statusUrl: `/api/analysis/${jobId}/status`,
      estimatedTime: req.body.reportType === 'quick' ? '2-3 minuter' : '3-5 minuter'
    });
  } catch (error) {
    console.error('Failed to start analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Kunde inte starta analys'
    });
  }
});

/**
 * GET /api/analysis/:jobId/status
 * Hämta status för ett jobb
 */
router.get('/:jobId/status', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const status = await analysisService.getJobStatus(jobId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Job hittades inte'
      });
    }

    res.json({
      success: true,
      ...status,
      reportUrl: status.status === 'completed' ? `/api/analysis/${jobId}/report` : null,
      dataUrl: status.status === 'completed' ? `/api/analysis/${jobId}/data` : null
    });
  } catch (error) {
    console.error('Failed to get job status:', error);
    res.status(500).json({
      success: false,
      error: 'Kunde inte hämta status'
    });
  }
});

/**
 * GET /api/analysis/:jobId/report
 * Ladda ner PDF-rapport
 */
router.get('/:jobId/report', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const reportPath = await analysisService.getReportPath(jobId);

    if (!reportPath) {
      return res.status(404).json({
        success: false,
        error: 'Rapport hittades inte'
      });
    }

    res.download(reportPath, `fastighetsanalys_${jobId}.pdf`);
  } catch (error) {
    console.error('Failed to download report:', error);
    res.status(500).json({
      success: false,
      error: 'Kunde inte ladda ner rapport'
    });
  }
});

/**
 * GET /api/analysis/:jobId/data
 * Hämta strukturerad data (JSON)
 */
router.get('/:jobId/data', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const data = await analysisService.getResultData(jobId);

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Data hittades inte'
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Failed to get result data:', error);
    res.status(500).json({
      success: false,
      error: 'Kunde inte hämta data'
    });
  }
});

export default router;
```

### 3. Registrera routes i main app

```typescript
// app.ts eller index.ts
import analysisRoutes from './routes/analysis.routes';

app.use('/api/analysis', analysisRoutes);
```

## 🎨 Frontend Integration

### React Exempel

```typescript
// components/AnalysisButtons.tsx
import { useState } from 'react';
import axios from 'axios';

interface AnalysisButtonsProps {
  propertyData: any; // Din fastighetdata
}

export const AnalysisButtons: React.FC<AnalysisButtonsProps> = ({ propertyData }) => {
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);

  const startAnalysis = async (reportType: 'quick' | 'full') => {
    setLoading(true);

    try {
      // Starta analys
      const { data } = await axios.post('/api/analysis/start', {
        ...propertyData,
        reportType
      });

      setJobId(data.jobId);

      // Börja polla status
      pollStatus(data.jobId);
    } catch (error) {
      console.error('Failed to start analysis:', error);
      alert('Kunde inte starta analys');
      setLoading(false);
    }
  };

  const pollStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get(`/api/analysis/${jobId}/status`);
        setStatus(data);

        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
          setLoading(false);

          if (data.status === 'completed') {
            // Visa success och download-länk
            alert('Analys klar!');
          } else {
            alert('Analys misslyckades: ' + data.error);
          }
        }
      } catch (error) {
        console.error('Failed to poll status:', error);
        clearInterval(interval);
        setLoading(false);
      }
    }, 5000); // Poll var 5:e sekund
  };

  const downloadReport = () => {
    if (jobId) {
      window.open(`/api/analysis/${jobId}/report`, '_blank');
    }
  };

  return (
    <div className="analysis-buttons">
      <button
        onClick={() => startAnalysis('quick')}
        disabled={loading}
        className="btn btn-primary"
      >
        {loading ? 'Bearbetar...' : 'Quick Analysis (2-3 min)'}
      </button>

      <button
        onClick={() => startAnalysis('full')}
        disabled={loading}
        className="btn btn-secondary"
      >
        {loading ? 'Bearbetar...' : 'Full Analysis (3-5 min)'}
      </button>

      {status && (
        <div className="status-display">
          <p>Status: {status.message}</p>
          <progress value={status.progress} max={100} />
          <span>{status.progress}%</span>
        </div>
      )}

      {status?.status === 'completed' && (
        <button onClick={downloadReport} className="btn btn-success">
          Ladda ner rapport (PDF)
        </button>
      )}
    </div>
  );
};
```

## 🔒 Säkerhet och permissions

### 1. Sätt rätt permissions på job-mappen

```bash
# På servern
sudo mkdir -p /var/app/jobs
sudo chown node-user:node-user /var/app/jobs
chmod 755 /var/app/jobs
```

### 2. Lägg till i .env (både Node och Python behöver läsa)

```bash
# /var/app/.env
GOOGLE_PLACES_API_KEY=...
TRAFIKLAB_API_KEY=...
LANTMATERIET_API_KEY=...
LANTMATERIET_API_SECRET=...
ANTHROPIC_API_KEY=...
```

### 3. Authenticering

```typescript
// Lägg till middleware för att säkra endpoints
router.post('/start', authenticateUser, async (req, res) => {
  // Spara userId med jobbet
  const userId = req.user.id;
  // ...
});

router.get('/:jobId/report', authenticateUser, checkJobOwnership, async (req, res) => {
  // Endast job-ägaren kan ladda ner
});
```

## 🧹 Cleanup cron job

```typescript
// Schemalägg cleanup (t.ex. med node-cron)
import cron from 'node-cron';

// Kör varje natt kl 03:00
cron.schedule('0 3 * * *', async () => {
  const deleted = await analysisService.cleanupOldJobs(7);
  console.log(`Cleaned up ${deleted} old analysis jobs`);
});
```

## ✅ Testa integrationen

### 1. Starta Node-server

```bash
cd /var/app/backend
npm run dev
```

### 2. Testa via curl

```bash
# Starta analys
curl -X POST http://localhost:3000/api/analysis/start \
  -H "Content-Type: application/json" \
  -d '{
    "kommun": "Umeå",
    "reportType": "quick",
    "befolkning": {...},
    "inkomst": {...}
  }'

# Hämta status
curl http://localhost:3000/api/analysis/{jobId}/status

# Ladda ner rapport
curl http://localhost:3000/api/analysis/{jobId}/report --output rapport.pdf
```

## 🎯 Nästa steg

1. Kopiera och anpassa Node-koden till din backend
2. Testa lokalt med test-data
3. Deploya till server
4. Koppla ihop med dina frontend-knappar
5. Testa end-to-end!
