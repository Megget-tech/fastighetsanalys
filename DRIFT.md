# Drift på Render

Appen körs som två delar, beskrivna i [render.yaml](render.yaml):

| Del | Render-typ | Vad |
|---|---|---|
| `fdata-db` | Postgres 16 (PostGIS) | DeSO-områden och API-cache |
| `fastighetsanalys` | Webbtjänst, Docker ([Dockerfile](Dockerfile)) | Frontend, API **och** analysen (Python i `analysis/`) |

Backend serverar den byggda frontenden på samma adress som API:t, så att inloggningen skyddar allt.

## Inloggning

Som i Volymstudie: en användare med HTTP Basic (webbläsarens egen inloggningsruta), satt med
`FDATA_ANVANDARE` och `FDATA_LOSENORD`.

- Satta: allt kräver inloggning utom `/health` (Renders hälsokontroll).
- Inte satta i drift (`NODE_ENV=production`, som Docker-imagen sätter): alla anrop vägras med 503.
  Tjänsten ligger aldrig öppen av misstag.
- Lokalt med `npm run dev` krävs ingen inloggning (variablerna är inte satta).

Webbläsaren kommer ihåg inloggningen tills den stängs. Byt lösenord genom att ändra `FDATA_LOSENORD` under
Environment på Render (tjänsten startas om).

## Analysen

Analysen (tidigare repot `Megget-tech/fanalys`) ligger i `analysis/` och körs av backend som underprocess.
Den startas som ett bakgrundsjobb: `POST /api/analysis/quick|full` svarar direkt med ett `jobId`, och
frontend frågar `GET /api/analysis/jobs/:id` var fjärde sekund tills den är klar. Rapporterna hämtas via
`GET /api/analysis/jobs/:id/files/:nyckel` och städas bort efter 6 timmar.

## Första gången

1. Pusha `main` till GitHub.
2. Render → **New → Blueprint** → välj repot. Render läser `render.yaml` och frågar efter värdena med `sync: false`:
   - `FDATA_ANVANDARE`: användarnamnet
   - `FDATA_LOSENORD`: ett långt lösenord (t.ex. fyra–fem slumpade ord)
   - `MAPBOX_TOKEN`: samma som `VITE_MAPBOX_TOKEN` i `frontend/.env`
   - `ANTHROPIC_API_KEY`, `GOOGLE_PLACES_API_KEY`, `TRAFIKLAB_API_KEY`, `LANTMATERIET_API_KEY/SECRET`
     (samma som i `analysis/.env` lokalt)
   - `LM_CONSUMER_KEY/SECRET`, `REGBET_CONSUMER_KEY/SECRET` (samma som i `backend/.env`)
3. Importera DeSO-områdena till databasen (en gång, ca 6 160 områden). Kopiera databasens
   **External Database URL** från Render och kör lokalt:

   ```bash
   cd backend
   DATABASE_URL='<External Database URL>' DATABASE_SSL=true npm run import-deso
   ```
4. I Mapbox (account.mapbox.com → Tokens): lägg till tjänstens adress (t.ex. `https://fastighetsanalys.onrender.com`)
   som tillåten URL om token är begränsad.

## Kostnad (ungefär)

- Tjänsten `starter`: 7 USD/mån. Gratisnivån somnar efter 15 min utan trafik, vilket bryter pågående fullanalyser.
- Databas `basic-256mb`: ca 6 USD/mån. Gratisdatabasen raderas efter 30 dagar.
- Analysen anropar Claude via `ANTHROPIC_API_KEY` och kostar per körning.

## Bra att veta

- **Pågående analyser tappas vid omstart/ny version** (jobben ligger i minnet). Frontend visar då ett fel.
- Högst 2 analyser körs samtidigt (`ANALYSIS_MAX_RUNNING`), fler får svar 429.
- Uppladdade nyproduktionsfiler sparas bara under analysen (temp), ingen beständig disk behövs.
- Mapbox-token läses vid körning från `/config.js` (miljövariabeln `MAPBOX_TOKEN`), inte vid bygget.

## Lokalt

Som tidigare (`npm run dev` i `backend/` och `frontend/`). Analysen körs från `analysis/` med Python från
`PYTHON_PATH` i `backend/.env`; nycklarna läses från `analysis/.env` (kopiera från `.env.example`).

Testa Docker-imagen lokalt (frontend + API på http://localhost:3000) mot databasen i docker-compose:

```bash
docker build -t fdata .
docker run --rm -p 3000:3000 -e DATABASE_URL=postgresql://fdata_user:fdata_pass@host.docker.internal:5432/fdata -e FDATA_ANVANDARE=prov -e FDATA_LOSENORD=prov-losen -e MAPBOX_TOKEN=pk.... --env-file analysis/.env fdata
```
