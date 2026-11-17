# Integration Guide - Node Backend → Python Analysis

Detta guide visar hur du kopplar ihop ditt Node/Express-program med Python-analysprogrammet.

## 📋 Översikt

```
Frontend (React/Vue)
      ↓
      ↓ Click "Quick Analysis" eller "Full Analysis"
      ↓
Node/Express Backend
      ↓
      ↓ POST /api/analysis/start
      ↓
      ├─ Skapar job-mapp: /var/app/jobs/{job-id}/
      ├─ Sparar input.json
      └─ Spawnar Python-process (non-blocking)
            ↓
            Python analyze_cli.py
                  ↓
                  ├─ Läser input.json
                  ├─ Mappar data
                  ├─ Hämtar API-data (OSM, Trafiklab, Google, Lantmäteriet)
                  ├─ Kör AI-analyser (LangGraph workflow)
                  ├─ Genererar PDF
                  └─ Sparar resultat
                        ├─ status.json (uppdateras kontinuerligt)
                        ├─ report.pdf
                        └─ data.json
      ↓
Node Backend
      ↓
      ↓ GET /api/analysis/{job-id}/status (pollas var 5:e sekund)
      ↓
Frontend
      ↓
      ↓ När status === "completed"
      ↓
      ↓ GET /api/analysis/{job-id}/report
      ↓
Användaren laddar ner PDF
```

## 🚀 Snabbstart

### 1. Installera dependencies (Python)

```bash
cd /Users/patrikpettersson/Documents/fanalys/real_estate_analysis
pip3 install --user -r requirements.txt
```

### 2. Testa Python CLI lokalt

```bash
# Skapa test-mapp
mkdir -p /tmp/test-jobs/test-123

# Kopiera exempel-input
cp docs/input_example.json /tmp/test-jobs/test-123/input.json

# Sätt API-nycklar
export GOOGLE_PLACES_API_KEY=...
export TRAFIKLAB_API_KEY=...
export LANTMATERIET_API_KEY=...
export LANTMATERIET_API_SECRET=...
export ANTHROPIC_API_KEY=...

# Kör analys
python3 analyze_cli.py \
  --job-id test-123 \
  --report-type quick \
  --jobs-dir /tmp/test-jobs

# Följ status
watch -n 2 cat /tmp/test-jobs/test-123/status.json

# Efter ~2-3 min finns rapport
open /tmp/test-jobs/test-123/report.pdf
```

### 3. Kopiera Node-kod till din backend

Se `NODE_INTEGRATION_EXAMPLE.md` för fullständig kod.

**Snabb-version:**

```typescript
// routes/analysis.routes.ts
import { Router } from 'express';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';

const router = Router();

router.post('/start', async (req, res) => {
  const jobId = uuidv4();
  const jobDir = `/var/app/jobs/${jobId}`;

  // Skapa mapp och spara input
  await fs.mkdir(jobDir, { recursive: true });
  await fs.writeFile(
    `${jobDir}/input.json`,
    JSON.stringify(req.body, null, 2)
  );

  // Spawna Python
  spawn('python3', [
    '/var/app/analysis/analyze_cli.py',
    '--job-id', jobId,
    '--report-type', req.body.reportType,
    '--jobs-dir', '/var/app/jobs'
  ], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env }
  }).unref();

  res.json({ jobId });
});

router.get('/:jobId/status', async (req, res) => {
  const status = JSON.parse(
    await fs.readFile(`/var/app/jobs/${req.params.jobId}/status.json`, 'utf-8')
  );
  res.json(status);
});

router.get('/:jobId/report', async (req, res) => {
  res.download(`/var/app/jobs/${req.params.jobId}/report.pdf`);
});

export default router;
```

### 4. Uppdatera dina frontend-knappar

```typescript
// I din React-komponent
const handleQuickAnalysis = async () => {
  // Hämta fastighetdata från ditt system
  const propertyData = await fetchPropertyData();

  // Starta analys
  const { jobId } = await fetch('/api/analysis/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...propertyData,
      reportType: 'quick'
    })
  }).then(r => r.json());

  // Polla status
  const interval = setInterval(async () => {
    const status = await fetch(`/api/analysis/${jobId}/status`).then(r => r.json());

    if (status.status === 'completed') {
      clearInterval(interval);
      window.location.href = `/api/analysis/${jobId}/report`;
    }
  }, 5000);
};
```

## 📝 Input-format

Se `input_example.json` för komplett exempel.

**Minimalt exempel:**

```json
{
  "report_type": "quick",
  "kommun": "Umeå",
  "property_designation": "UMEÅ TOLVMANSGÅRDEN 4",

  "befolkning": {
    "total_befolkning": 5527
  },

  "inkomst": {
    "medianinkomst_område": 333729
  },

  "prisanalys": {
    "medelpris": 1966366,
    "medel_kr_m2": 29615
  }
}
```

**Alla fält som mappas:**

| Ditt fält | Mappas till | Används av |
|-----------|-------------|------------|
| `kommun` | `project_params.municipality` | Alla agenter |
| `property_designation` | `project_params.property_designation` | Area Context |
| `befolkning.*` | `demographics_data.*` | Demographics Agent |
| `åldersfördelning.*` | `demographics_data.age_distribution` | Demographics Agent |
| `inkomst.*` | `demographics_data.*_income` | Demographics Agent |
| `utbildning.*` | `demographics_data.education` | Demographics Agent |
| `hushåll.*` | `demographics_data.households` | Demographics Agent |
| `upplåtelseform.*` | `market_data.tenure_types` | Market Data Agent |
| `prisanalys.*` | `market_data.*` | Market Data + Competition |
| `flyttmönster.*` | `migration_data.*` | Migration Agent |

## 🔄 Status-flöde

```json
// Initial status
{
  "job_id": "abc-123",
  "status": "processing",
  "progress": 0,
  "message": "Startar analys...",
  "updated_at": "2026-01-13T12:00:00"
}

// Under körning
{
  "status": "processing",
  "progress": 45,
  "message": "Kör Quick Analysis (3 agenter)...",
  "updated_at": "2026-01-13T12:01:30"
}

// Klar
{
  "status": "completed",
  "progress": 100,
  "message": "Analys slutförd!",
  "updated_at": "2026-01-13T12:02:45"
}

// Fel
{
  "status": "failed",
  "progress": 0,
  "message": "Fel vid analys",
  "error": "API-nyckel saknas: ANTHROPIC_API_KEY",
  "updated_at": "2026-01-13T12:01:00"
}
```

## 🎯 Output-filer

### 1. `report.pdf`
- Färdig PDF-rapport med all analys
- Quick: ~5-10 sidor
- Full: ~15-25 sidor
- Innehåller kartor, grafer, AI-insikter

### 2. `data.json`
```json
{
  "analysis_result": {
    "demographics_output": {...},
    "market_data_output": {...},
    "migration_output": {...},
    "pdf_path": "..."
  },
  "input_data": {...},
  "area_context": {
    "location": {...},
    "services_within_1km": {...},
    "transit_access": {...}
  }
}
```

### 3. `status.json`
- Se ovan för format
- Uppdateras kontinuerligt under körning

## ⏱️ Tidsuppskattningar

| Report Type | Tid | Antal agenter | API-anrop |
|-------------|-----|---------------|-----------|
| **Quick** | 2-3 min | 3 | ~15-20 |
| **Full** | 3-5 min | 7 | ~25-35 |

**Vad tar tid:**
- Area Context (API-anrop): 30-60 sek
- AI-analyser (Claude API): 1-2 min
- PDF-generering: 10-20 sek

## 🔒 Säkerhet

### 1. API-nycklar

Lägg i `.env` på servern:

```bash
# /var/app/.env
GOOGLE_PLACES_API_KEY=xxx
TRAFIKLAB_API_KEY=xxx
LANTMATERIET_API_KEY=xxx
LANTMATERIET_API_SECRET=xxx
ANTHROPIC_API_KEY=xxx
```

### 2. Permissions

```bash
# Skapa job-mapp med rätt permissions
sudo mkdir -p /var/app/jobs
sudo chown node-user:node-user /var/app/jobs
chmod 755 /var/app/jobs
```

### 3. Authenticering

```typescript
// Skydda endpoints
router.post('/start', authenticateUser, async (req, res) => {
  // Spara user ID
  const userId = req.user.id;
  // ...
});

router.get('/:jobId/report', authenticateUser, checkJobOwnership, async (req, res) => {
  // Endast job-ägaren kan ladda ner
});
```

## 🧹 Cleanup

```typescript
// Rensa gamla jobs (7+ dagar)
import cron from 'node-cron';

cron.schedule('0 3 * * *', async () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const jobs = await fs.readdir('/var/app/jobs');

  for (const jobId of jobs) {
    const stats = await fs.stat(`/var/app/jobs/${jobId}`);
    if (stats.mtime < cutoff) {
      await fs.rm(`/var/app/jobs/${jobId}`, { recursive: true });
    }
  }
});
```

## 🐛 Troubleshooting

### Problem: Python-processen startar inte

```bash
# Kontrollera att Python finns
which python3

# Testa manuellt
python3 /var/app/analysis/analyze_cli.py --help

# Kolla permissions
ls -la /var/app/analysis/analyze_cli.py
```

### Problem: API-nycklar fungerar inte

```bash
# Kolla miljövariabler
echo $ANTHROPIC_API_KEY

# Testa API-nyckel direkt
curl -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-5-5","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

### Problem: Jobs tar för lång tid

```bash
# Följ Python-process
ps aux | grep analyze_cli

# Kolla status-fil
cat /var/app/jobs/{job-id}/status.json

# Debug-läge
python3 analyze_cli.py --job-id test --report-type quick --jobs-dir /tmp 2>&1 | tee debug.log
```

## 📚 Relaterade dokument

- `NODE_INTEGRATION_EXAMPLE.md` - Fullständig Node-kod
- `input_example.json` - Exempel på input-format
- `QUICK_ANALYSIS_GUIDE.md` - Info om Quick Analysis
- `USING_AREA_CONTEXT.md` - Info om Area Context

## ✅ Checklista för deployment

- [ ] Python dependencies installerade
- [ ] API-nycklar i `.env`
- [ ] `/var/app/jobs` mapp skapad med rätt permissions
- [ ] Node-endpoints implementerade
- [ ] Frontend-knappar kopplade
- [ ] Testat lokalt med test-data
- [ ] Authenticering implementerad
- [ ] Cleanup cron job konfigurerad
- [ ] Monitoring/logging setup
- [ ] Error handling testad

## 🎉 Nästa steg

1. Testa Python CLI lokalt med exempel-input
2. Implementera Node-endpoints i din backend
3. Koppla ihop frontend-knapparna
4. Testa end-to-end lokalt
5. Deploya till server
6. Testa i produktion!
