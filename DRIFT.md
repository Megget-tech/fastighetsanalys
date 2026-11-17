# Drift på Render

Appen körs som tre delar, alla beskrivna i [render.yaml](render.yaml):

| Del | Render-typ | Vad |
|---|---|---|
| `fdata-db` | Postgres 16 (PostGIS) | DeSO-områden och API-cache |
| `fdata-backend` | Webbtjänst, Docker ([Dockerfile](Dockerfile)) | Express-API:t **och** analysen (Python i `analysis/`) |
| `fdata-frontend` | Statisk sida | React-appen (`frontend/dist`) |

Analysen (tidigare repot `Megget-tech/fanalys`) ligger i `analysis/` och körs av backend som underprocess.
Den startas som ett bakgrundsjobb: `POST /api/analysis/quick|full` svarar direkt med ett `jobId`, och
frontend frågar `GET /api/analysis/jobs/:id` var fjärde sekund tills den är klar. Rapporterna hämtas via
`GET /api/analysis/jobs/:id/files/:nyckel` och städas bort efter 6 timmar.

## Första gången

1. Pusha `main` till GitHub.
2. Render → **New → Blueprint** → välj repot. Render läser `render.yaml` och frågar efter värdena med `sync: false`:
   - `FRONTEND_URL`: `https://fdata-frontend.onrender.com` (eller det namn Render ger frontend)
   - `VITE_API_URL`: `https://fdata-backend.onrender.com`
   - `ANTHROPIC_API_KEY`, `GOOGLE_PLACES_API_KEY`, `TRAFIKLAB_API_KEY`, `LANTMATERIET_API_KEY/SECRET`
     (samma som i `analysis/.env` lokalt)
   - `LM_CONSUMER_KEY/SECRET`, `REGBET_CONSUMER_KEY/SECRET` (samma som i `backend/.env`)
   - `VITE_MAPBOX_TOKEN` (samma som i `frontend/.env`)

   Om Render ger tjänsterna andra adresser än ovan (namnet upptaget): rätta `FRONTEND_URL` och `VITE_API_URL`
   under Environment och gör **Manual Deploy** på frontend (Vite bakar in adressen vid bygget).
3. Importera DeSO-områdena till databasen (en gång, ca 6 160 områden). Kopiera databasens
   **External Database URL** från Render och kör lokalt:

   ```bash
   cd backend
   DATABASE_URL='<External Database URL>' DATABASE_SSL=true npm run import-deso
   ```
4. I Mapbox (account.mapbox.com → Tokens): lägg till frontendens adress som tillåten URL om token är begränsad.

## Kostnad (ungefär)

- Backend `starter`: 7 USD/mån. Gratisnivån somnar efter 15 min utan trafik, vilket bryter pågående fullanalyser.
- Databas `basic-256mb`: ca 6 USD/mån. Gratisdatabasen raderas efter 30 dagar.
- Frontend: gratis.
- Analysen anropar Claude via `ANTHROPIC_API_KEY` och kostar per körning.

## Bra att veta

- **Ingen inloggning.** API:t och analysen är öppna för den som hittar adressen, och varje analys kostar
  Anthropic-krediter. Lägg till skydd innan adressen sprids.
- **Pågående analyser tappas vid omstart/ny version** (jobben ligger i minnet). Frontend visar då ett fel.
- Högst 2 analyser körs samtidigt (`ANALYSIS_MAX_RUNNING`), fler får svar 429.
- Uppladdade nyproduktionsfiler sparas bara under analysen (temp), ingen beständig disk behövs.

## Lokalt

Som tidigare (`npm run dev` i `backend/` och `frontend/`). Analysen körs från `analysis/` med Python från
`PYTHON_PATH` i `backend/.env`; nycklarna läses från `analysis/.env` (kopiera från `.env.example`).

Testa Docker-imagen lokalt mot databasen i docker-compose:

```bash
docker build -t fdata-backend .
docker run --rm -p 3000:3000 -e DATABASE_URL=postgresql://fdata_user:fdata_pass@host.docker.internal:5432/fdata --env-file analysis/.env fdata-backend
```
