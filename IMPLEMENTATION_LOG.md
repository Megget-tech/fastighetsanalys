# Fastighetsanalys - Implementation Log

**Datum**: 2025-12-29 - 2025-12-31
**Status**: MVP implementerat med multi-area analys + utökad befolkningsdata

---

## Översikt

Webb-applikation för fastighetsanalys i Sverige med fokus på DeSO-områden (Demografiska Statistikområden).

### Tech Stack
- **Backend**: Node.js + Express + TypeScript + PostgreSQL + PostGIS
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Karta**: Mapbox GL JS
- **Datakällor**: SCB (Statistiska Centralbyrån), Lantmäteriet

---

## Implementerade funktioner

### ✅ Kartfunktionalitet
- [x] Mapbox-karta centrerad på hela Sverige (center: [15.0, 62.0], zoom: 4.5)
- [x] Rita polygoner med Mapbox Draw
- [x] Hitta DeSO-områden inom polygon (PostGIS ST_Intersects, >10% överlapp)
- [x] Visa DeSO-gränser som overlay

### ✅ Multi-area analys
- [x] Checklist med alla matchade DeSO-områden
- [x] Användaren kan välja/välja bort områden
- [x] Aggregerad data för valda områden:
  - Population-viktad median för inkomst och utbildning
  - Summerad population och flyttningar
  - Genomsnittlig tillväxthastighet

### ✅ SCB-data integration
**Implementerade metrics:**
- **Inkomst** (HE0110T01): Median/medelinkomst per DeSO
- **Befolkning** (BE0101T01): Total population, tillväxt
- **Åldersfördelning** (BE0101T04): 0-19, 20-39, 40-64, 65+
- **Utbildning** (UF0506T01): Förgymnasial, Gymnasial, Eftergymnasial
- **Flyttmönster** (TAB5724): Nettoinflyttning på RegSO-nivå
- **Härkomst** (FolkmDesoBakgrKon): Svensk/utländsk bakgrund per DeSO *(2025-12-31)*
- **Hushållsstorlek** (HushallT03): 1, 2, 3+ personer per hushåll *(2025-12-31)*

**Cache-strategi:**
- L1: In-memory cache (node-cache)
- L2: PostgreSQL cache
- L3: SCB API (rate-limited med p-queue)

**DeSO → RegSO mapping:**
- 6,161 mappningar från SCB Excel
- Lagrat i `src/data/deso-regso-mapping.json`

### ✅ Flyttmönster-data
**Implementering:**
- RegSO-nivå data från SCB TAB5724
- Endast nettoinflyttning (absoluta tal ej tillgängliga)
- Origins/destinations mockdata borttagen (fanns ej i SCB publika API)

**Visning:**
- Nettoinflyttning med färgkodning (blå=positiv, orange=negativ)
- Info-ruta: "Detaljerad ursprungs/destinations-data ej tillgänglig"

### ✅ Fastighetssökning (förberedd)
**Backend:**
- `lantmateriet.service.ts`: Service för Lantmäteriet API
- `properties.routes.ts`: API endpoints
  - `GET /api/properties/search?q=NACKA SALTSJÖ-BOO 1:123`
  - `GET /api/properties/validate?q=...`

**Frontend:**
- `PropertySearch.tsx`: Sökkomponent
- Integration med kartan (polygon från fastighetsgräns)

**Status:** Väntar på API-credentials från Lantmäteriet

### ✅ Utökad befolkningsstatistik (2025-12-31)
**Nyimplementerade metrics:**

1. **Härkomst (Origin Metrics)**
   - Svensk bakgrund (antal personer)
   - Utländsk bakgrund (antal personer)
   - Procent utländsk bakgrund
   - **SCB Tabell**: FolkmDesoBakgrKon (BE0101Y)
   - **Nivå**: DeSO-nivå (försök), fallback till mock data om ej tillgängligt
   - **Aggregering**: Summera absoluta tal, räkna om procent

2. **Hushållsstorlek (Household Metrics)**
   - Totalt antal hushåll
   - 1-personshushåll (antal)
   - 2-personshushåll (antal)
   - 3+ personshushåll (antal)
   - Genomsnittlig hushållsstorlek (beräknad: `(1p*1 + 2p*2 + 3+p*3.5) / totalt`)
   - **SCB Tabell**: HushallT03 (BE0101S)
   - **Nivå**: RegSO-nivå (DeSO ej tillgängligt i publika API:et)
   - **Aggregering**: Summera absoluta tal, räkna om genomsnitt

**Backend Implementation:**
- `scb-api.service.ts` - nya funktioner `getOriginDataFromSCB()` och `getHouseholdDataFromSCB()`
- `scb.service.ts` - wrapper-funktioner `getOriginMetrics()` och `getHouseholdMetrics()`
- `types.ts` - nya interfaces `OriginMetrics` och `HouseholdMetrics`
- `data.routes.ts` - Uppdaterat `GetMetricsResponse` och `/api/data/metrics/:desoCode` endpoint
- `cache.service.ts` - Stöd för 3-lager cache (memory → db → API), inklusive lantmäteriet
- Aggregering: Fullständig stöd i `getAggregatedMetrics()` för multi-area analys
- Fallback: Mock data om SCB API misslyckas

**Frontend Implementation:**
- `frontend/src/types/index.ts` - nya TypeScript interfaces `OriginMetrics` och `HouseholdMetrics`
- `frontend/src/App.tsx` - nya UI-sektioner för härkomst och hushållsstorlek
- **Härkomst-visning**: 2-kolumn layout med svensk/utländsk bakgrund, visuell progressbar
- **Hushållsstorlek-visning**: Total + breakdown (1p, 2p, 3+p) med progressbars, genomsnittlig storlek

**Begränsningar:**
- Hushållsdata: Endast tillgänglig på RegSO-nivå, inte DeSO-nivå
- Familjer efter antal barn: Endast kommun-nivå, därför ej implementerat
- SCB publika API har begränsad tillgänglighet för vissa tabeller

---

## Databasschema

### `deso_areas`
```sql
CREATE TABLE deso_areas (
  deso_code VARCHAR(9) PRIMARY KEY,
  name VARCHAR(255),
  kommun_code VARCHAR(4),
  kommun_name VARCHAR(255),
  lan_code VARCHAR(2),
  lan_name VARCHAR(100),
  category CHAR(1) CHECK (category IN ('A', 'B', 'C')),
  population INTEGER,
  geom GEOMETRY(MultiPolygon, 4326),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Index:**
- Spatial index: `GIST(geom)`
- Standard: `deso_code`, `kommun_code`

### `scb_time_series`
```sql
CREATE TABLE scb_time_series (
  id SERIAL PRIMARY KEY,
  deso_code VARCHAR(9) REFERENCES deso_areas(deso_code),
  metric_type VARCHAR(50),
  time_period DATE,
  value DECIMAL(15,2),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `api_cache`
```sql
CREATE TABLE api_cache (
  cache_key VARCHAR(255) PRIMARY KEY,
  response_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
```

---

## Projektstruktur

```
fdata/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts              # PostgreSQL + PostGIS
│   │   ├── routes/
│   │   │   ├── areas.routes.ts          # DeSO-sökning
│   │   │   ├── data.routes.ts           # Metrics & aggregering
│   │   │   └── properties.routes.ts     # Fastighetssökning
│   │   ├── services/
│   │   │   ├── cache.service.ts         # 3-lager cache
│   │   │   ├── scb.service.ts           # SCB data aggregering
│   │   │   ├── scb-api.service.ts       # SCB API integration
│   │   │   ├── geo.service.ts           # PostGIS queries
│   │   │   ├── booli-mock.service.ts    # Mock Booli data
│   │   │   └── lantmateriet.service.ts  # Lantmäteriet API (förberedd)
│   │   ├── models/
│   │   │   └── types.ts                 # TypeScript interfaces
│   │   ├── data/
│   │   │   └── deso-regso-mapping.json  # 6,161 mappningar
│   │   ├── utils/
│   │   │   └── rate-limiter.ts          # p-queue för SCB
│   │   └── server.ts                    # Express server
│   ├── scripts/
│   │   └── import-deso-geodata.ts       # Import DeSO från SCB WFS
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Map/
│   │   │   │   └── MapView.tsx          # Mapbox + draw controls
│   │   │   └── PropertySearch.tsx       # Fastighetssökning
│   │   ├── store/
│   │   │   └── analysisStore.ts         # Zustand state
│   │   ├── services/
│   │   │   └── api.ts                   # Backend API client
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── App.tsx                      # Main component
│   ├── .env.example
│   └── package.json
└── docker-compose.yml                    # PostgreSQL + PostGIS
```

---

## API Endpoints

### Areas
- `POST /api/areas/find-deso` - Hitta DeSO inom polygon
- `GET /api/areas/deso/:desoCode` - Hämta DeSO info
- `GET /api/areas/boundaries/deso?codes=...` - Hämta DeSO-gränser

### Data
- `GET /api/data/metrics/:desoCode` - Alla metrics för ett DeSO
- `POST /api/data/metrics/aggregated` - Aggregerad data för flera DeSO
- `GET /api/data/timeseries/:desoCode/:metric` - Tidsserie-data
- `GET /api/data/kommun/:kommunCode` - Kommun-data
- `GET /api/data/riket` - Riksdata

### Properties (förberedd)
- `GET /api/properties/search?q=NACKA SALTSJÖ-BOO 1:123`
- `GET /api/properties/validate?q=...`

### System
- `GET /health` - Health check
- `GET /api/stats` - Queue & cache stats

---

## Aggregeringslogik

### Population-viktad median (Inkomst & Utbildning)
```typescript
const weightedMedianIncome = validMetrics.reduce((sum, m) => {
  const pop = m.metrics.population.total || 0;
  const income = m.metrics.income.median_income || 0;
  return sum + (income * pop);
}, 0) / totalPopulation;
```

### Summering (Population & Flyttningar)
```typescript
const totalPopulation = validMetrics.reduce(
  (sum, m) => sum + (m.metrics.population.total || 0),
  0
);
```

### Genomsnitt (Tillväxthastighet)
```typescript
const avgGrowthRate = validMetrics.reduce(
  (sum, m) => sum + (m.metrics.population.growth_rate || 0),
  0
) / validMetrics.length;
```

---

## Viktiga designbeslut

### 1. Flyttmönster-data
**Problem:** SCB:s publika API har inte detaljerad origin/destination-data på DeSO-nivå.

**Lösning:**
- Visa endast nettoinflyttning från RegSO-nivå
- Tog bort mockad Stockholm-data
- Info till användaren om begränsningen

### 2. Multi-area aggregering
**Problem:** Flera DeSO kan ha olika RegSO (för flyttmönster).

**Lösning:**
- Summera inflyttade/utflyttade över alla områden
- Netto = total_inflyttade - total_utflyttade

### 3. Cache-strategi
**Problem:** SCB API är långsam (30+ sekunder för vissa queries).

**Lösning:**
- 3-lager cache (memory → db → API)
- TTL: 5 min (memory), 24h (db)
- Rate limiting: Max 10 req/s till SCB

### 4. Kartvy
**Problem:** Inzoomad på Stockholm från början.

**Lösning:**
- Center: [15.0, 62.0] (centrala Sverige)
- Zoom: 4.5 (visar hela landet)

---

## Environment-variabler

### Backend `.env`
```bash
DATABASE_URL=postgresql://fdata_user:fdata_pass@localhost:5432/fdata
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

SCB_API_BASE_URL=https://statistikdatabasen.scb.se/api/v2
SCB_RATE_LIMIT=10

# Lantmäteriet (fyll i när du får credentials)
LM_WFS_URL=https://api.lantmateriet.se/...
LM_API_KEY=your_api_key_here
```

### Frontend `.env`
```bash
VITE_MAPBOX_TOKEN=pk.your_token_here
VITE_API_URL=http://localhost:3000/api
```

---

## Kända buggar & begränsningar

### Buggar
- Inga kända buggar för tillfället

### Begränsningar
1. **Flyttmönster**: Endast netto på RegSO-nivå, inte detaljerad origin/destination
2. **Tidsserier**: Endast senaste året (historik 5+ år planerad för v2)
3. **Booli data**: Mock data (riktigt API ej integrerat)
4. **Fastighetssökning**: Väntar på Lantmäteriet API-credentials

---

## Nästa steg (v2)

### Planerade funktioner
- [ ] Riktigt Booli GraphQL API
- [ ] Full historik 5-10 år för tidsserier
- [ ] PDF/Excel export (bara CSV nu)
- [ ] Län-till-län flyttmönster (från SCB)
- [ ] Fastighetssökning aktivering (när credentials finns)
- [ ] User accounts & sparade analyser
- [ ] Heatmaps på kartan
- [ ] Prediktiv analys (trends, forecasts)

### Teknisk skuld
- [ ] Bättre error handling i frontend
- [ ] Loading states för varje metric
- [ ] Optimera cache cleanup
- [ ] Unit tests
- [ ] E2E tests

---

## Deployment-anteckningar

### Prerequisites
1. PostgreSQL 16 + PostGIS 3.4
2. Node.js 20+
3. Mapbox API token
4. Lantmäteriet API credentials (för fastighetssökning)

### Setup
```bash
# 1. Database
docker-compose up -d

# 2. Import DeSO geodata (10 min, 6,160 områden)
cd backend
npm run import-deso

# 3. Backend
npm run build
npm start

# 4. Frontend
cd frontend
npm run dev
```

### Production considerations
- [ ] SSL/TLS certificates
- [ ] Reverse proxy (nginx)
- [ ] PM2 för backend process management
- [ ] Database backups
- [ ] Monitoring (Sentry, Datadog)
- [ ] Rate limiting på API
- [ ] CORS whitelist

---

## Resurser & Dokumentation

### SCB
- [PxWebAPI 2.0 dokumentation](https://www.scb.se/vara-tjanster/oppna-data/api-for-statistikdatabasen/)
- [Statistikdatabasen](https://www.statistikdatabasen.scb.se/)
- [DeSO 2025 WFS](https://geodata.scb.se/geoserver/stat/wfs)

### Lantmäteriet
- [Fastighetsindelning Direkt](https://geotorget.lantmateriet.se/dokumentation/GEODOK/81/latest.html)
- [Geotorget](https://geotorget.lantmateriet.se/)

### Mapbox
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)
- [Mapbox Draw](https://github.com/mapbox/mapbox-gl-draw)

### PostGIS
- [PostGIS dokumentation](https://postgis.net/documentation/)
- [Spatial queries](https://postgis.net/docs/reference.html)

---

## Kontakt & Support

**Projekt**: Fastighetsanalys MVP
**Version**: 1.0.0
**Skapad**: December 2025
**Senast uppdaterad**: 2025-12-30

För frågor eller support, se projektets README.md.
