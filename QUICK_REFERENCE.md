# Snabbguide - Fastighetsanalys

## 🚀 Vanliga Kommandon

### Starta Applikationen

```bash
# 1. Starta PostgreSQL (första terminalen)
docker-compose up -d

# 2. Starta backend (andra terminalen)
cd backend
npm run dev

# 3. Starta frontend (tredje terminalen)
cd frontend
npm run dev

# 4. Öppna i browser
open http://localhost:5173
```

### Stoppa Applikationen

```bash
# Stoppa backend & frontend
Ctrl+C i respektive terminal

# Stoppa PostgreSQL
docker-compose down
```

### Importera DeSO Data (EN GÅNG)

```bash
cd backend
npm run import-deso
# Vänta ~5-10 minuter
```

### Troubleshooting

```bash
# Backend connection error?
docker-compose ps                    # Kontrollera PostgreSQL
docker-compose up -d                 # Starta om

# Dependencies fel?
cd backend && npm install
cd frontend && npm install

# Databas reset (OBS: Raderar all data!)
docker-compose down -v
docker-compose up -d
cd backend && npm run import-deso
```

### Deployment

```bash
# Railway (Backend + DB)
railway login
railway link
railway run npm run import-deso      # EN GÅNG

# Vercel (Frontend)
cd frontend
vercel
vercel --prod
```

## 📋 Viktiga Filer

```
.env files:
  backend/.env          - DATABASE_URL, PORT, SCB_API_BASE_URL
  frontend/.env         - VITE_MAPBOX_TOKEN, VITE_API_URL

Konfiguration:
  docker-compose.yml    - PostgreSQL setup
  backend/tsconfig.json - TypeScript config
  frontend/vite.config.ts - Vite config

Huvudfiler:
  backend/src/server.ts - Express server
  backend/src/services/geo.service.ts - PostGIS queries
  frontend/src/App.tsx - Main UI
  frontend/src/components/Map/MapView.tsx - Mapbox karta
```

## 🔗 Viktiga URLs

```
Lokal utveckling:
  Frontend:  http://localhost:5173
  Backend:   http://localhost:3000
  Health:    http://localhost:3000/health
  Stats:     http://localhost:3000/api/stats

Dokumentation:
  README.md              - Översikt
  GETTING_STARTED.md     - Detaljerad setup
  PROJECT_HISTORY.md     - Fullständig historik
  QUICK_REFERENCE.md     - Denna fil

Externa tjänster:
  Mapbox:    https://account.mapbox.com
  Railway:   https://railway.app
  Vercel:    https://vercel.com
  SCB WFS:   https://geodata.scb.se
```

## 💡 Tips

- **Restart Vite** efter .env ändringar: Ctrl+C → `npm run dev`
- **DeSO import** behövs bara EN GÅNG per databas
- **Mapbox token** måste börja med `pk.`
- **PostgreSQL** måste köra INNAN backend startas
- **Railway import** görs EN GÅNG med `railway run npm run import-deso`

## ⚡ Snabbkommandon

```bash
# Full restart
docker-compose restart && cd backend && npm run dev

# Verifiera DeSO data
docker exec -it fdata-postgres psql -U fdata_user -d fdata -c "SELECT COUNT(*) FROM deso_areas;"

# Se PostgreSQL loggar
docker-compose logs -f postgres

# Clean install
rm -rf backend/node_modules frontend/node_modules
cd backend && npm install
cd ../frontend && npm install

# Git push
git add .
git commit -m "Update"
git push
```
