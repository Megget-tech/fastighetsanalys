# Kom igång med Fastighetsanalys MVP

## ✅ Vad som är klart

**Backend (100% komplett):**
- ✅ PostgreSQL + PostGIS databas setup
- ✅ DeSO geodata import script
- ✅ SCB API service (med mock data för MVP)
- ✅ Booli mock service (realistisk testdata)
- ✅ Geo service (PostGIS polygon → DeSO mapping)
- ✅ Cache system (3-lager: memory → database → API)
- ✅ Rate limiting för API-anrop
- ✅ REST API endpoints
- ✅ Express server med error handling

**Frontend (grundläggande UI klar):**
- ✅ React + TypeScript + Vite setup
- ✅ Tailwind CSS konfiguration
- ✅ API client med Axios
- ✅ Zustand state management
- ✅ Bas-UI med metrics display
- ⚠️  Mapbox-karta behöver implementeras (se nedan)

## 🚀 Starta applikationen (5 steg)

### Steg 1: Installera dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Steg 2: Skaffa Mapbox API key

1. Gå till https://account.mapbox.com/auth/signup/
2. Skapa gratis konto (inga kreditkort krävs)
3. Kopiera din "Default public token"
4. Öppna `frontend/.env` och ersätt:
   ```
   VITE_MAPBOX_TOKEN=pk.din_riktiga_token_här
   ```

**Gratis tier:** 50,000 map loads/månad (mer än tillräckligt för utveckling)

### Steg 3: Starta PostgreSQL + PostGIS

```bash
# Från root-mappen (fdata/)
docker-compose up -d

# Verifiera att databasen körs
docker-compose ps
```

Du bör se något liknande:
```
NAME               STATUS
fdata-postgres     Up X seconds (healthy)
```

### Steg 4: Importera DeSO geodata

⚠️ **VIKTIGT:** Detta måste göras innan backend kan användas!

```bash
cd backend
npm run import-deso
```

Detta tar ~5-10 minuter och importerar ~6,160 DeSO-områden från SCB.

**Förväntad output:**
```
✅ DeSO GEODATA IMPORT COMPLETE
=============================================================
Imported:    6160 new areas
Total in DB: 6160 DeSO areas
=============================================================
```

### Steg 5: Starta backend och frontend

Öppna **två terminaler**:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

Vänta tills du ser:
```
✅ FASTIGHETSANALYS BACKEND RUNNING
Server: http://localhost:3000
✨ Ready to accept requests!
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Öppna sedan http://localhost:5173 i webbläsaren.

## 📝 Vad behöver implementeras

### Mapbox-karta (högsta prioritet)

Mapbox-komponenten behöver skapas. Här är en grundläggande implementation:

**Skapa `frontend/src/components/Map/MapView.tsx`:**

```typescript
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useAnalysisStore } from '../../store/analysisStore';
import type { GeoJSONPolygon } from '../../types';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);

  const { setSelectedPolygon } = useAnalysisStore();

  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return; // Initialize map only once

    // Create map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [18.0686, 59.3293], // Stockholm
      zoom: 10
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add draw control
    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      },
      defaultMode: 'simple_select'
    });

    map.current.addControl(draw.current, 'top-left');

    // Handle polygon creation
    map.current.on('draw.create', handleDrawUpdate);
    map.current.on('draw.update', handleDrawUpdate);
    map.current.on('draw.delete', () => setSelectedPolygon(null));

    return () => {
      map.current?.remove();
    };
  }, []);

  function handleDrawUpdate() {
    if (!draw.current) return;

    const data = draw.current.getAll();
    if (data.features.length > 0) {
      const polygon = data.features[0].geometry as GeoJSONPolygon;
      setSelectedPolygon(polygon);
    }
  }

  return <div ref={mapContainer} className="w-full h-[600px] rounded-lg" />;
}
```

**Uppdatera `App.tsx`** för att använda komponenten:
```typescript
import { MapView } from './components/Map/MapView';

// Ersätt placeholder-div med:
<MapView />
```

### CSV Export (medel prioritet)

**Skapa `frontend/src/components/Export/CsvExport.tsx`:**

```typescript
import { useAnalysisStore } from '../../store/analysisStore';

export function CsvExport() {
  const { metrics, desoResult } = useAnalysisStore();

  const exportToCSV = () => {
    if (!metrics || !desoResult) return;

    const rows = [
      ['DeSO Kod', desoResult.deso_codes[0]],
      ['Område', desoResult.deso_names[0]],
      ['Kommun', desoResult.kommun_name],
      [''],
      ['Inkomst'],
      ['Medianinkomst', metrics.metrics.income.median_income],
      ['Medelinkomst', metrics.metrics.income.mean_income],
      [''],
      ['Befolkning'],
      ['Total', metrics.metrics.population.total],
      ['Tillväxt (%)', metrics.metrics.population.growth_rate],
      // ... lägg till fler rader
    ];

    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `fastighetsanalys-${desoResult.deso_codes[0]}.csv`;
    a.click();
  };

  return (
    <button
      onClick={exportToCSV}
      disabled={!metrics}
      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg transition"
    >
      Exportera till CSV
    </button>
  );
}
```

### Tidsseriegraf (låg prioritet)

**Skapa `frontend/src/components/Dashboard/TimeSeriesChart.tsx`:**

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useAnalysisStore } from '../../store/analysisStore';

export function TimeSeriesChart() {
  const { timeSeries } = useAnalysisStore();

  if (!timeSeries) return null;

  return (
    <div>
      <h3 className="font-semibold mb-3">Utveckling över tid</h3>
      <LineChart width={500} height={300} data={timeSeries.deso_data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="value" stroke="#3b82f6" name={timeSeries.metric_name} />
      </LineChart>
    </div>
  );
}
```

## 🧪 Testa applikationen

1. Öppna http://localhost:5173
2. Verifiera att "Backend: connected" visas i headern
3. När Mapbox-kartan är implementerad:
   - Klicka på polygon-verktyget
   - Rita en polygon över ett område (t.ex. Stockholm)
   - Se metrics visas i högra panelen

## ❓ Troubleshooting

### Backend startar inte
- Kontrollera att PostgreSQL körs: `docker-compose ps`
- Kontrollera att .env finns i backend/
- Se loggar: `docker-compose logs postgres`

### "No DeSO geodata found"
- Kör import-scriptet: `cd backend && npm run import-deso`
- Detta måste göras innan backend kan användas

### Frontend visar "Backend: disconnected"
- Kontrollera att backend körs på port 3000
- Testa manuellt: `curl http://localhost:3000/health`

### Mapbox-kartan laddas inte
- Kontrollera att `VITE_MAPBOX_TOKEN` är satt i frontend/.env
- Verifiera token på https://account.mapbox.com/
- Se browser console för felmeddelanden

## 📚 Dokumentation

- **Backend API:** Se `backend/src/routes/` för endpoints
- **Frontend State:** Se `frontend/src/store/analysisStore.ts`
- **Typer:** Se `frontend/src/types/index.ts`

## 🎯 Nästa steg (efter MVP)

1. Ersätt SCB mock data med riktiga API-anrop
2. Integrera Booli GraphQL API (när API-access finns)
3. Multi-area jämförelse
4. PDF/Excel export
5. User accounts & sparade analyser
6. Deployment (Vercel/Railway + Supabase)

Lycka till! 🚀
