# Claude Code - Fastighetsanalysprogram Projekthistorik

**Senast uppdaterad:** 2026-01-03
**Status:** MVP 99% Klar - Export implementerat
**Nästa session:** Testa export-funktionen, eventuella bugfixar, överväg prisgrafer när Booli/Mäklarstatistik API finns

---

## 📋 Snabb Översikt

Detta är en webb-applikation för fastighetsanalys med fokus på DeSO-områden i Sverige. Systemet hämtar demografisk, socioekonomisk och bostadsdata från SCB:s publika API och presenterar det i en interaktiv kartvy med detaljerade jämförelser mot kommun- och riksnivå.

**Tech Stack:**
- Backend: Node.js + Express + TypeScript + PostgreSQL + PostGIS
- Frontend: React + TypeScript + Vite + Tailwind CSS + Mapbox GL JS
- Data: SCB PxWebAPI v1/v2, PostGIS för geodata

---

## 🚀 Starta Projektet

### Backend (Terminal 1)
```bash
cd /Users/patrikpettersson/Documents/fdata/backend
npm run dev

# Backend körs på http://localhost:3000
# Task ID: bfaa828 (kan vara annorlunda)
```

### Frontend (Terminal 2)
```bash
cd /Users/patrikpettersson/Documents/fdata/frontend
npm run dev

# Frontend körs på http://localhost:5173
# Task ID: b2e35e6 (kan vara annorlunda)
```

### Database
```bash
# PostgreSQL + PostGIS körs i Docker
docker-compose ps  # Verifiera att den körs
docker-compose up -d  # Starta om nödvändigt
```

**VIKTIGT:** DeSO geodata är redan importerad (6,160 områden). Behöver bara köras en gång.

---

## ✅ Vad Som Är Implementerat (99%)

### Kartfunktionalitet
- ✅ Interaktiv Mapbox-karta med polygon-ritning
- ✅ Automatisk DeSO-matchning via PostGIS ST_Intersects
- ✅ Multi-area support med checkbox-lista
- ✅ Population-weighted aggregering för flera områden

### SCB Data (8 Huvudmetrics)
Alla metrics har **både DeSO-nivå OCH kommun-jämförelser:**

1. ✅ **Inkomst** - Median/mean, percentiler, kommun/riket jämförelse
2. ✅ **Befolkning** - Total, tillväxt, 17 åldersgrupper med kommun-jämförelse per grupp
3. ✅ **Utbildning** - 3 nivåer med kommun/riket jämförelse
4. ✅ **Härkomst** - Svensk/utländsk bakgrund med kommun-jämförelse
5. ✅ **Hushållsstorlek** - Snitt + detaljerad fördelning (1p/2p/3+p) med kommun-jämförelse
6. ✅ **Hustyp** - Småhus/flerbostadshus med kommun-jämförelse
7. ✅ **Upplåtelseform** - Äganderätt/bostadsrätt/hyresrätt med kommun-jämförelse
8. ✅ **Flyttmönster** - Nettoinflyttning (RegSO-nivå)
9. ✅ **Ekonomisk standard** - Kvartiler med kommun-jämförelse
10. ✅ **Förvärvsinkomst** - Kvartiler med kommun-jämförelse

### Visualiseringar
- ✅ Metrics cards med färgkodade jämförelser (↑/↓ indikatorer)
- ✅ **Dubbla staplar** för alla fördelningar (mörk = område, ljus = kommun)
- ✅ Detaljerade procentjämförelser för varje undermått
- ✅ Responsive design

### Export
- ✅ **CSV Export** implementerad (`/src/utils/csvExport.ts`)
- ✅ Inkluderar ALL data + kommun-jämförelser
- ✅ UTF-8 BOM för Excel-kompatibilitet
- ✅ Filnamn: `fastighet_[kommun]_[datum].csv`

### Backend Infrastructure
- ✅ PostgreSQL + PostGIS med 6,160 DeSO-områden
- ✅ 3-lager cache (memory → DB → API)
- ✅ Rate limiting (10 req/s)
- ✅ Dual API support (SCB v1 + v2)
- ✅ DeSO → RegSO mapping för flyttmönster

---

## 🐛 Kritiska Bugfixar Som Gjorts

### Bug 1: Härkomst Dubbelräkning (2026-01-01)
**Problem:** Visade 3,412 personer med utländsk bakgrund i område med 1,847 invånare.

**Orsak:** `filter: "all"` för Kön-variabeln returnerade män + kvinnor + totalt → summerades alla tre.

**Fix:**
```typescript
// Före:
{ code: "Kon", selection: { filter: "all", values: ["*"] } }

// Efter:
{ code: "Kon", selection: { filter: "item", values: ["1+2"] } } // Endast totalt
```

**Fil:** `/Users/patrikpettersson/Documents/fdata/backend/src/services/scb-api.service.ts` (rad ~630-730)

---

### Bug 2: Härkomst Omvända Koder (2026-01-01)
**Problem:** Svensk bakgrund visades som utländsk och vice versa.

**Orsak:** Felaktig tolkning av SCB:s koder.

**Fix:** Kod "1" = Utländsk bakgrund, Kod "2" = Svensk bakgrund (INTE tvärtom!)

**Fil:** `/Users/patrikpettersson/Documents/fdata/backend/src/services/scb-api.service.ts` (rad ~630-730)

---

### Bug 3: Hushåll Mock Data (2026-01-01)
**Problem:** Använde mock data istället för riktig SCB-data.

**Orsak:** HushallT26 saknar DeSO-stöd → HTTP 400 → fallback till mock.

**Fix:** Bytte till **HushallDesoTyp** (BE0101Y) som stödjer både DeSO och kommun.

**Implementation:** Mappar hushållstyper (ESUB, SBUB, ESMB, SBMB, OVRIGA) till storlekar.

**Fil:** `/Users/patrikpettersson/Documents/fdata/backend/src/services/scb-api.service.ts` (rad ~736-851)

---

### Bug 4: TypeScript Build Errors (2026-01-03)
**Problem:** Build failade pga saknade type definitions.

**Fix:**
1. Skapade `/Users/patrikpettersson/Documents/fdata/frontend/src/vite-env.d.ts`
2. Lade till `AggregatedMetrics` och andra typer i `/src/types/index.ts`
3. Fixade optional chaining i csvExport.ts

---

## 📊 SCB API Tabeller (Referens)

| Metric | DeSO Tabell | Kommun Tabell | API Version |
|--------|-------------|---------------|-------------|
| Income | HE0110T01 | HE0110A01 | v1 |
| Population (total) | BE0101N01 | - | v2 |
| Population (ålder) | FolkmangdNy | FolkmangdNy | v1 |
| Education | UF0506A01 | UF0506B01 | v1 |
| Origin | UtlSvBakgTot | UtlSvBakgTot | v1 |
| Household | HushallDesoTyp | HushallDesoTyp | v1 |
| Housing Type | HushallT32Deso | HushallT21B | v1 |
| Tenure Form | HushallT33Deso | HushallT23 | v1 |
| Economic Std | HE0110T18 | HE0110T18 | v1 |
| Earned Income | HE0110T19 | HE0110T19 | v1 |
| Migration | BE0101J01 (via RegSO) | - | v1 |

**VIKTIGT:**
- DeSO-tabeller kräver `_DeSO2025` suffix på region-koden
- Använd ALLTID `filter: "item", values: ["1+2"]` för totalt (inte `filter: "all"`)
- API v1 Base: `https://api.scb.se/OV0104/v1/doris/sv/ssd/`
- API v2 Base: `https://statistikdatabasen.scb.se/api/v2/`

---

## 📁 Viktiga Filer & Vad De Gör

### Backend

**`/backend/src/services/scb-api.service.ts`** (1600+ rader)
- **MEST KRITISK FIL** - Alla SCB API-anrop
- Funktioner för varje metric (income, population, education, etc.)
- Kommun-nivå funktioner (getIncomeDataForKommun, etc.)
- Cache-logik
- Rate limiting med p-queue

**Viktiga funktioner:**
- `getOriginDataFromSCB()` - Härkomst (FIXADE dubbelräkning + omvända koder)
- `getHouseholdDataFromSCB()` - Hushåll (använder HushallDesoTyp, INTE HushallT26)
- `getHousingTypeDataFromSCB()` - Hustyp (DeSO-nivå)
- `getHousingTypeDataForKommun()` - Hustyp (kommun-nivå)
- `getTenureFormDataFromSCB()` - Upplåtelseform

**`/backend/src/routes/data.routes.ts`**
- API endpoints för metrics
- `/api/data/aggregated` - Hämtar aggregerad data för flera DeSO

**`/backend/src/config/database.ts`**
- PostgreSQL + PostGIS setup
- Schema initialization

### Frontend

**`/frontend/src/App.tsx`** (1000+ rader)
- **HUVUDFIL** - All UI och visualiseringar
- Alla metrics-sektioner med kommun-jämförelser
- Dubbla staplar för åldersfördelning, hushållsstorlek, upplåtelseform
- Export-knapp (rad ~996-1008)

**`/frontend/src/utils/csvExport.ts`**
- CSV export-funktionalitet
- Formaterar ALL data till CSV
- UTF-8 BOM för Excel

**`/frontend/src/types/index.ts`**
- TypeScript interfaces
- `AggregatedMetrics` - huvudtypen för all data
- `HousingTypeMetrics`, `TenureFormMetrics`, etc.

**`/frontend/src/store/analysisStore.ts`**
- Zustand state management
- `aggregatedMetrics` - innehåller all hämtad data

**`/frontend/src/vite-env.d.ts`**
- Type definitions för Vite & Mapbox Draw
- VIKTIGT för TypeScript build

---

## 🎯 Kommun-Jämförelser Implementation

### Översiktsnivå (Cards)
Visar kommun-värde med ↑/↓ indikator i:
- Inkomst (median)
- Utbildning (eftergymnasial %)
- Ekonomisk standard (median/mean)
- Förvärvsinkomst (median/mean)

### Detaljnivå (Breakdowns)

**Pattern som används:**
```tsx
// Dubbla staplar
<div className="space-y-1">
  {/* Område bar */}
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div className="bg-blue-600 h-2" style={{ width: `${areaPercentage}%` }} />
  </div>
  {/* Kommun bar */}
  <div className="w-full bg-gray-100 rounded-full h-2">
    <div className="bg-blue-300 h-2" style={{ width: `${kommunPercentage}%` }} />
  </div>
</div>
```

**Implementerat för:**
1. ✅ **Åldersfördelning** - Alla 17 grupper (rad ~427-476 i App.tsx)
2. ✅ **Hushållsstorlek** - 1p/2p/3+p (rad ~567-621)
3. ✅ **Hustyp** - Småhus/flerbostadshus (rad ~579-614)
4. ✅ **Upplåtelseform** - Äganderätt/bostadsrätt/hyresrätt (rad ~747-797)
5. ✅ **Härkomst** - Svensk/utländsk (rad ~478-515)

---

## ⚠️ Kända Begränsningar

### 1. Tidsserier
- ❌ Ingen prishistorikgraf i frontend (Booli mock data har `price_trend` men används ej)
- **Decision:** Väntar på riktigt Booli/Mäklarstatistik API innan implementering
- Backend har timeseries endpoint men används inte än

### 2. Flyttmönster
- ⚠️ Endast netto-inflyttning (RegSO-nivå)
- ❌ Detaljerad ursprungs/destinations-data finns ej på DeSO-nivå i SCB API

### 3. Booli Data
- ⚠️ Mock data (realistisk testdata med 150 försäljningar)
- ❌ Riktigt Booli GraphQL API ej implementerat
- ✅ Interface är redo för integration

### 4. Multi-Area
- ✅ Fungerar för aggregerad data
- ❌ Kan ej visa flera områden side-by-side (v2 feature)

---

## 🔜 Nästa Steg När Du Återupptar

### Omedelbart (Nästa Session)
1. **Testa CSV Export:**
   - Rita ett område på kartan
   - Klicka "Exportera till CSV"
   - Verifiera att filen laddas ner korrekt
   - Öppna i Excel/Numbers och kolla format
   - Bugfixa om nödvändigt

2. **UI/UX Polish:**
   - Lägg till tooltips med förklaringar (? ikoner)
   - Förbättra error states
   - Lägg till loading spinners per sektion
   - Kanske "Hjälp"-modal med förklaringar

3. **Performance Check:**
   - Testa med många områden (5-10 DeSO samtidigt)
   - Verifiera cache fungerar (kolla backend logs)
   - Mät load times

### Om Booli/Mäklarstatistik API Blir Tillgängligt
1. Ersätt mock Booli service
2. Implementera riktiga prisgrafer (LineChart med Recharts)
3. Lägg till i tidsseriegrafer-sektion

### v2 Features (Framtid)
- Multi-area side-by-side jämförelse
- PDF/Excel export med inbäddade grafer
- User accounts & sparade analyser
- Heatmaps på karta
- 5-10 års historik (kräver SCB API-research)

---

## 💡 Viktiga Insikter För Nästa Claude

### 1. SCB API är Inkonsekvent
- Vissa tabeller kräver `_DeSO2025` suffix, andra inte
- API v1 och v2 har helt olika query-format
- Trial-and-error är nödvändigt
- Använd browser DevTools → Network tab för att se faktiska responses

### 2. Kön-Filtrering är KRITISK
**Detta är den vanligaste källan till buggar!**

```typescript
// ❌ FEL - Ger dubbelräkning
{ code: "Kon", selection: { filter: "all", values: ["*"] } }

// ✅ RÄTT - Endast totalt
{ code: "Kon", selection: { filter: "item", values: ["1+2"] } }  // Eller ["4"] i vissa tabeller
```

**Varför?** `filter: "all"` returnerar separata rader för män, kvinnor OCH totalt. Om du summerar får du 2-3x för många personer!

### 3. Cache Är Nödvändigt
- Första anropet tar 8-12 sekunder (13 parallella SCB API-anrop)
- Cached response: <100ms
- 24h TTL är rimligt (SCB uppdaterar sällan)

### 4. PostGIS ST_Intersects
- Mycket snabbt (50-200ms för 6,160 polygoner)
- Kräver GIST-index (redan skapat)
- Använd WGS84 (EPSG:4326) för Mapbox-kompatibilitet

### 5. Type Safety Sparar Tid
- TypeScript interfaces för alla SCB responses
- `AggregatedMetrics` är huvudtypen - den innehåller ALLT
- Build ofta för att hitta type errors tidigt

---

## 🔍 Debugging Tips

### Backend Logs
Backend loggar mycket detaljerat:
```
[SCB Queue] Adding task: income-2480C1310-2023 (Queue size: 0)
[Cache MISS] scb:cc50befb10fc06a30f65a7b306ebf986
[SCB API] Income for 2480C1310: Median 323400 kr, Mean 368300 kr
```

**Vanliga problem:**
- HTTP 400 från SCB → Fel tabell/variable/kod
- "No data in response" → Kontrollera år, region-kod, suffix
- Queue piling up → Rate limit träffad, vänta 1 min

### Frontend DevTools
- Network tab → Kolla `/api/data/aggregated` response
- Console → Kolla efter errors
- React DevTools → Inspektera `aggregatedMetrics` i Zustand store

### Database
```bash
# Kolla DeSO count
docker exec -it fdata-postgres-1 psql -U fdata_user -d fdata -c "SELECT COUNT(*) FROM deso_areas;"

# Kolla cache
docker exec -it fdata-postgres-1 psql -U fdata_user -d fdata -c "SELECT COUNT(*) FROM api_cache;"

# Rensa cache (om buggar)
docker exec -it fdata-postgres-1 psql -U fdata_user -d fdata -c "DELETE FROM api_cache;"
```

---

## 📦 Dependencies & Versions

### Backend
```json
{
  "express": "^4.18.2",
  "pg": "^8.11.3",
  "postgis": "^0.2.2",
  "axios": "^1.6.0",
  "p-queue": "^7.4.1",
  "node-cache": "^5.1.2"
}
```

### Frontend
```json
{
  "react": "^18.2.0",
  "vite": "^5.4.21",
  "mapbox-gl": "^3.0.0",
  "@mapbox/mapbox-gl-draw": "^1.4.3",
  "recharts": "^2.10.0",
  "zustand": "^4.4.7"
}
```

---

## 🎓 Kodmönster & Conventions

### Backend Service Pattern
```typescript
export async function getXDataFromSCB(desoCode: string, year: string = '2024'): Promise<XMetrics | null> {
  const cacheKey = `scb:${hash([desoCode, year])}`;

  // Check cache
  const cached = await getFromCache(cacheKey);
  if (cached) return cached;

  // Build SCB query
  const query: SCBV1Query = { /* ... */ };

  // Fetch from API
  const response = await axios.post(url, query);

  // Parse and return
  const result = parseResponse(response.data);

  // Cache it
  await saveToCache(cacheKey, result, 86400);

  return result;
}
```

### Frontend Component Pattern
```tsx
{metrics && (
  <div>
    <h3>Metric Name</h3>
    <div className="space-y-2">
      {data.map(item => {
        const areaValue = item.value;
        const kommunValue = metrics.kommun_avg?.value;

        return (
          <div key={item.key} className="space-y-1">
            {/* Area bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2" style={{ width: `${areaValue}%` }} />
            </div>
            {/* Kommun bar */}
            {kommunValue && (
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-blue-300 h-2" style={{ width: `${kommunValue}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
)}
```

---

## 🗂️ Projektstruktur

```
/Users/patrikpettersson/Documents/fdata/
├── backend/
│   ├── src/
│   │   ├── server.ts                      # Express server
│   │   ├── config/database.ts             # PostgreSQL + PostGIS
│   │   ├── services/
│   │   │   ├── scb-api.service.ts        # ⭐ KRITISK - All SCB integration
│   │   │   ├── geo.service.ts            # PostGIS polygon → DeSO
│   │   │   ├── cache.service.ts          # 3-layer cache
│   │   │   └── booli-mock.service.ts     # Mock Booli data
│   │   ├── routes/
│   │   │   ├── areas.routes.ts           # /api/areas/*
│   │   │   └── data.routes.ts            # /api/data/*
│   │   └── data/
│   │       └── deso_regso_mapping.json   # DeSO → RegSO för migration
│   └── scripts/
│       └── import-deso-geodata.ts        # Import 6,160 DeSO (redan kört)
├── frontend/
│   ├── src/
│   │   ├── App.tsx                       # ⭐ HUVUDFIL - All UI (1000+ rader)
│   │   ├── components/
│   │   │   ├── Map/MapView.tsx           # Mapbox + draw
│   │   │   └── PropertySearch.tsx        # Sökfält (placeholder)
│   │   ├── store/analysisStore.ts        # Zustand state
│   │   ├── services/api.ts               # Backend API client
│   │   ├── types/index.ts                # ⭐ TypeScript types
│   │   ├── utils/csvExport.ts            # CSV export logic
│   │   └── vite-env.d.ts                 # ⭐ Type definitions (viktigt!)
│   └── dist/                             # Build output
├── docker-compose.yml                     # PostgreSQL + PostGIS
├── README.md                              # Setup instruktioner
├── STATUS.md                              # ⭐ Fullständig statusrapport
└── claude.md                              # ⭐ DENNA FIL
```

---

## 🔐 Miljövariabler & Secrets

### Backend `.env`
```bash
DATABASE_URL=postgresql://fdata_user:fdata_pass@localhost:5432/fdata
PORT=3000
NODE_ENV=development
SCB_API_BASE_URL=https://statistikdatabasen.scb.se/api/v2
SCB_RATE_LIMIT=10
```

### Frontend `.env`
```bash
VITE_API_URL=http://localhost:3000/api
VITE_MAPBOX_TOKEN=pk.xxx...  # Mapbox token (gratis tier)
```

**VIKTIGT:** `.env` filer är .gitignored. Använd `.env.example` som mall.

---

## 🧪 Verifierad Data (Test Cases)

### DeSO 2480C1310 (Umeå - Villaområde)
```
Befolkning: 1,847
Svensk bakgrund: 1,706 (92.4%) ✅
Utländsk bakgrund: 141 (7.6%) ✅
Hushåll: 901 × 1.93 ≈ 1,736 personer (94% av 1,847) ✅
Småhus: 963 personer (52.5%) ✅
Eftergymnasial: 58.3% ✅
```

### DeSO 0180C3940 (Stockholm)
```
Befolkning: 1,513
Svensk bakgrund: 1,188 (78.5%) ✅
Utländsk bakgrund: 325 (21.5%) ✅
```

**Validering:**
- ✅ Summa härkomst = total befolkning
- ✅ Hushållsstorlek × antal ≈ befolkning (±5%)
- ✅ Alla procentandelar summerar till ~100%

---

## 📝 Kommandon För Nästa Session

### Kolla Status
```bash
# Backend
cd /Users/patrikpettersson/Documents/fdata/backend
npm run dev  # Borde starta på http://localhost:3000

# Frontend
cd /Users/patrikpettersson/Documents/fdata/frontend
npm run dev  # Borde starta på http://localhost:5173

# Database
docker-compose ps  # Verifiera PostgreSQL körs
docker-compose logs postgres  # Kolla logs om problem

# Kolla att DeSO finns
docker exec -it fdata-postgres-1 psql -U fdata_user -d fdata -c "SELECT COUNT(*) FROM deso_areas;"
# Borde returnera: 6160
```

### Bygga
```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
# Borde lyckas utan errors
```

### Testa Export
1. Öppna http://localhost:5173
2. Rita en polygon på kartan
3. Vänta på data (8-12 sek första gången, <1s med cache)
4. Klicka "📥 Exportera till CSV" längst ner
5. Verifiera att `fastighet_[kommun]_[datum].csv` laddas ner
6. Öppna i Excel/Numbers - kolla att svenska tecken (å,ä,ö) visas rätt

---

## 💭 Konversationshistorik (Sammanfattning)

### Session 1-2: Initial Setup & Core Metrics
- Satte upp projekt enligt plan från `~/.claude/plans/nested-napping-turtle.md`
- Implementerade 8 SCB-metrics på DeSO-nivå
- Skapade PostGIS database med 6,160 DeSO-områden
- Frontend med Mapbox-karta och polygon-ritning

### Session 3: Kommun-Jämförelser (Start)
- Användaren bad om kommun-jämförelser för 5 metrics
- Implementerade kommun-nivå fetching för origin, age distribution, household, housing type, tenure form
- Problem: HTTP 400 errors från SCB → bytte till API v1

### Session 4: Data Quality Issues (2026-01-01)
**Användaren hittade 3 kritiska buggar:**

1. **Härkomst dubbelräkning:** 3,412 personer i område med 1,847 invånare
   - Fix: Bytte från `filter: "all"` till `filter: "item", values: ["1+2"]`

2. **Härkomst omvända koder:** Svensk visades som utländsk
   - Fix: Korrigerade kod-mappningen (1=utländsk, 2=svensk)

3. **Hushåll mock data:** Använde slumpdata istället för SCB
   - Fix: Bytte från HushallT26 till HushallDesoTyp

4. **Unit-förväxling (ej bug):** Hushåll (counts) vs Hustyp (persons)
   - Förklaring till användaren

### Session 5: Kommun-Jämförelser (Detaljnivå)
- Användaren bad om kommun-jämförelse på UNDERnivåer
- Implementerade dubbla staplar för:
  - Åldersfördelning (alla 17 grupper)
  - Hushållsstorlek (1p/2p/3+p)
  - Upplåtelseform (äganderätt/bostadsrätt/hyresrätt)

### Session 6: Dokumentation & Export (2026-01-03)
- Användaren bad om dokumentation
- Skapade STATUS.md (500+ rader fullständig statusrapport)
- Uppdaterade README.md
- Diskuterade tidsseriegrafer → beslut: vänta på Booli/Mäklarstatistik API
- Implementerade CSV export (csvExport.ts + uppdaterade App.tsx)
- Fixade TypeScript build errors (vite-env.d.ts + types)

**Status nu:** 99% klar till MVP!

---

## 🎯 Användarens Preferenser & Beslut

1. **Kommun-jämförelser:** Användaren ville ha DETALJERADE jämförelser på alla nivåer (inte bara overview)
   - Implementerat med dubbla staplar överallt

2. **Tidsseriegrafer:** Användaren valde att VÄNTA med prisgrafer tills riktigt API finns
   - Citat: "Vi kan lägga till prisgrafer sedan om jag får tag i api från mäklarstatistik eller booli"

3. **Export:** Ville ha CSV export först (inte PDF/Excel)
   - Implementerat, klar att testa

4. **Dokumentation:** Ville ha omfattande dokumentation för att kunna återuppta
   - STATUS.md + denna fil (claude.md)

---

## 🚨 Om Problem Uppstår

### Backend startar inte
```bash
# Kolla om port 3000 används
lsof -i :3000
kill -9 [PID]

# Kolla database connection
docker-compose ps
docker-compose restart postgres
```

### Frontend startar inte
```bash
# Kolla om port 5173 används
lsof -i :5173
kill -9 [PID]

# Rensa node_modules om build errors
rm -rf node_modules package-lock.json
npm install
```

### SCB API errors
- HTTP 400 → Kontrollera tabell-id, region-kod, år
- HTTP 429 → Rate limit, vänta 1 minut
- Timeout → SCB är långsam, öka timeout till 60s

### TypeScript build errors
- Kör `npm run build` i frontend/
- Vanliga fel: Missing types, optional chaining
- Kolla `vite-env.d.ts` finns och är korrekt

---

## 📚 Resurser & Referenser

### SCB API Dokumentation
- **PxWebAPI v1:** https://www.scb.se/vara-tjanster/oppna-data/api-for-statistikdatabasen/
- **PxWebAPI v2:** https://www.statistikdatabasen.scb.se/pxweb/sv/ssd/
- **Statistikdatabasen:** https://www.statistikdatabasen.scb.se/
- **WFS Geodata:** https://geodata.scb.se/geoserver/stat/wfs

### Mapbox
- **Dokumentation:** https://docs.mapbox.com/mapbox-gl-js/
- **Draw Plugin:** https://github.com/mapbox/mapbox-gl-draw
- **Konto:** https://account.mapbox.com/ (användarens token: se .env)

### PostgreSQL + PostGIS
- **PostGIS Docs:** https://postgis.net/docs/
- **ST_Intersects:** https://postgis.net/docs/ST_Intersects.html

---

## ✅ Slutsats & Nästa Steg

**MVP Status:** 99% Klar

**Kvar att göra:**
1. Testa CSV export (5-10 min)
2. Ev. bugfixar baserat på testning
3. UI/UX polish (valfritt)
4. User testing med riktiga användare

**När Booli/Mäklarstatistik API finns:**
- Ersätt mock service
- Implementera prisgrafer (Recharts LineChart)
- Lägg till i dashboard

**Detta projekt är mycket nära färdigt!** 🎉

---

**Skapad av:** Claude (Sonnet 4.5)
**För:** Patrik Pettersson
**Projekt:** Fastighetsanalysprogram MVP
**Datum:** 2026-01-03
