# Fastighetsanalysprogram (MVP)

Webb-applikation för fastighetsanalys med fokus på bostadsutveckling i Sverige.

> **📋 Detaljerad dokumentation:** Se [STATUS.md](STATUS.md) för fullständig implementationsstatus, buggfixar och teknisk dokumentation.

## Features (MVP v1.0 - 95% Klar)

### ✅ Implementerat
- 📍 **Interaktiv Mapbox-karta** med polygon-ritning
- 🗺️ **DeSO-matchning** via PostGIS (6,160 områden)
- 📊 **8 SCB-metrics** med kommun- och riksjämförelser:
  - Inkomst (median/mean + percentiler)
  - Befolkning (totalt + 17 åldersgrupper)
  - Utbildning (3 nivåer)
  - Härkomst (svensk/utländsk bakgrund)
  - Hushållsstorlek (snitt + fördelning 1p/2p/3+p)
  - Hustyp (småhus/flerbostadshus)
  - Upplåtelseform (äganderätt/bostadsrätt/hyresrätt)
  - Flyttmönster (netto)
  - Ekonomisk standard (kvartiler)
  - Förvärvsinkomst (kvartiler)
- 🔄 **Multi-area support** med aggregering (population-weighted)
- 📊 **Detaljerade visualiseringar** med dubbla staplar för kommun-jämförelser
- ⚡ **3-lager cache** (memory → DB → API) för <100ms response times
- 🏠 Bostadsförsäljningar (mock data, redo för Booli API)

### ⏳ Återstår (1-2 dagar)
- 📥 CSV export implementation
- 📈 Tidsseriegrafer i frontend
- 🎨 UI polish & error handling

## Tech Stack

**Backend:**
- Node.js + Express + TypeScript
- PostgreSQL + PostGIS
- SCB PxWebAPI 2.0

**Frontend:**
- React + TypeScript + Vite
- Tailwind CSS
- Mapbox GL JS
- Recharts
- Zustand

## Prerequisites

1. Node.js 18+ och npm
2. Docker och Docker Compose
3. Mapbox API key (gratis: https://account.mapbox.com/auth/signup/)

## Setup

### 1. Installera dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Konfigurera miljövariabler

```bash
# Backend
cd backend
cp .env.example .env
# Redigera .env om nödvändigt (standardvärden fungerar)

# Frontend
cd ../frontend
cp .env.example .env
# Lägg till din Mapbox token:
# VITE_MAPBOX_TOKEN=pk.xxx...
```

### 3. Starta PostgreSQL + PostGIS

```bash
# Från root-mappen
docker-compose up -d

# Verifiera att databasen körs
docker-compose ps
```

### 4. Importera DeSO geodata

⚠️ **KRITISKT STEG** - Detta måste köras innan backend startar första gången:

```bash
cd backend
npm run import-deso

# Tar ~5-10 minuter, importerar ~6,160 DeSO-områden från SCB
```

### 5. Starta applikationen

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Öppna http://localhost:5173 i webbläsaren.

## Användning

1. Rita en polygon på kartan med draw-verktyget
2. Systemet matchar automatiskt polygonen mot DeSO-områden
3. Data visas i panelen till höger:
   - Key metrics (inkomst, befolkning, etc.)
   - Tidsseriegrafer
   - Jämförelse mot kommun och riket
4. Exportera data till CSV

## API Endpoints

```
POST /api/areas/find-deso
  Body: { polygon: GeoJSON }
  Returns: Matchade DeSO-koder

GET /api/data/metrics/:deso_code
  Returns: Alla metrics för området

GET /api/data/timeseries/:deso_code/:metric
  Returns: Tidsserie-data

GET /api/data/booli/:deso_code
  Returns: Mock bostadsdata (ersätts med riktigt API senare)
```

## Projektstruktur

```
fdata/
├── backend/
│   ├── src/
│   │   ├── config/          # Database setup
│   │   ├── services/        # SCB, Geo, Cache, Booli mock
│   │   ├── routes/          # API routes
│   │   ├── models/          # TypeScript types
│   │   └── utils/           # Rate limiter, etc.
│   └── scripts/
│       └── import-deso-geodata.ts
├── frontend/
│   ├── src/
│   │   ├── components/      # Map, Dashboard, Export
│   │   ├── store/           # Zustand state
│   │   ├── services/        # API client
│   │   └── types/           # TypeScript types
└── docker-compose.yml
```

## Nästa Steg

### MVP Completion (Prio 1)
- [ ] **CSV export** - Implementera export-funktionalitet (1-2h)
- [ ] **Tidsseriegrafer** - Aktivera i frontend (2-3h)
- [ ] **UI/UX polish** - Error handling, loading states, tooltips (2-3h)

### v2 Features (Future)
- [ ] Multi-area side-by-side jämförelse
- [ ] PDF/Excel export med inbäddade grafer
- [ ] Full historik (5-10 år)
- [ ] Booli GraphQL API integration
- [ ] User accounts & sparade analyser
- [ ] Heatmaps och prediktiv analys

> **Status:** 95% klart till MVP-release. Se [STATUS.md](STATUS.md) för detaljerad roadmap.

## Troubleshooting

**Problem:** DeSO import failar
**Lösning:** Kontrollera att PostgreSQL körs (`docker-compose ps`) och att PostGIS extension är installerad

**Problem:** Frontend kan inte ansluta till backend
**Lösning:** Verifiera att backend körs på port 3000 och frontend på 5173

**Problem:** Mapbox-kartan laddas inte
**Lösning:** Kontrollera att `VITE_MAPBOX_TOKEN` är korrekt i frontend/.env

## Licens

MIT
