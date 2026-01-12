# Lantmäteriet API Setup Guide

## Översikt

Fastighetsökningen använder **två Lantmäteriet API:er**:

1. **Registerbeteckning Direkt** - För att söka och hitta fastigheter efter namn/beteckning
2. **OGC Features (Fastighetsindelning)** - För att hämta fastighetsgeometrier

### Hur det fungerar (två-stegs-process):

```
Användare söker "UMEÅ TOLVMANSGÅRDEN 4"
         ↓
[1] Registerbeteckning Direkt API
    → Returnerar objektidentitet (UUID)
         ↓
[2] OGC Features API
    → Hämtar geometri för fastighetsgräns
         ↓
    Visar fastighet på karta
```

## Förutsättningar

Du behöver API-credentials från Lantmäteriet för att använda funktionen.

## Steg 1: Skaffa API-access

### A. Skapa konto (om du inte har ett)

1. **Gå till Lantmäteriets API-portal:**
   https://www.lantmateriet.se/sv/Om-Lantmateriet/Samverkan-med-andra/api-portal/

2. **Beställ konto:**
   - Klicka på "Beställ konto"
   - Fyll i uppgifterna för ditt företag/organisation
   - Vänta på bekräftelse (kan ta några dagar)

### B. Prenumerera på båda API:erna

Du behöver prenumerera på **två API:er**:

#### 1. Registerbeteckning Direkt (VIKTIGT - måste göras först!)

1. Logga in på https://apimanager.lantmateriet.se/
2. Gå till "API Store" eller "APIs"
3. Sök efter **"Registerbeteckning Direkt"**
4. Klicka "Subscribe" / "Prenumerera"
5. Välj din Application
6. **Viktig juridisk bedömning:** Du måste godkänna särskilda villkor enligt fastighetsregisterslagen
7. **Kostnad:** GRATIS

#### 2. OGC-Features

1. I samma API-portal
2. Sök efter **"OGC-Features"**
3. Klicka "Subscribe" / "Prenumerera"
4. Välj din Application
5. Se till att du får scope: `ogc-features:fastighetsindelning.read`

## Steg 2: Hitta dina credentials

1. Logga in på https://apim.lantmateriet.se/
2. Gå till "Applications" eller "Mina applikationer"
3. Välj din applikation
4. Under "Consumer Keys" hittar du:
   - **Consumer Key** (ungefär 20-30 tecken)
   - **Consumer Secret** (ungefär 40-50 tecken, klicka "Show" för att se)

## Steg 3: Konfigurera backend

1. Öppna `/backend/.env`
2. Uppdatera följande variabler:

```bash
# OGC Features (för geometrier)
LM_CONSUMER_KEY=din_consumer_key_här
LM_CONSUMER_SECRET=din_consumer_secret_här

# Registerbeteckning Direkt (för sökning)
REGBET_CONSUMER_KEY=din_consumer_key_här
REGBET_CONSUMER_SECRET=din_consumer_secret_här
```

**OBS:** Du kan använda **samma Consumer Key och Secret** för båda API:erna!
(Om du har prenumererat på båda med samma Application)

3. Spara filen och starta om backend:

```bash
cd backend
npm run dev
```

## Steg 4: Testa sökningen

1. Starta både backend och frontend (se README.md)
2. Öppna http://localhost:5173
3. I sökfältet, skriv in en fastighetsbeteckning (nu mycket enklare format!):
   - `UMEÅ TOLVMANSGÅRDEN 4`
   - `STOCKHOLM KUNGSHOLMEN 1:1`
   - `NACKA ORMINGE 1`
   - `ÖSTERSUND NORR 1:12`
4. Klicka "Sök fastighet"

**Nya format som stöds:**
- `KOMMUN TRAKT BLOCK` (t.ex. "UMEÅ TOLVMANSGÅRDEN 4")
- `KOMMUN TRAKT BLOCK:ENHET` (t.ex. "STOCKHOLM KUNGSHOLMEN 1:1")
- `KOMMUN BLOCK` (t.ex. "UMEÅ 4") - söker alla trakter
- `KOMMUN BLOCK:ENHET` (t.ex. "NACKA 2:5")

## Hur det fungerar (Uppdaterad två-stegs-process)

### Steg 1: Frontend
- Användaren skriver in fastighetsbeteckning (t.ex. "UMEÅ TOLVMANSGÅRDEN 4")
- Anropar `/api/properties/search?q=UMEÅ TOLVMANSGÅRDEN 4`

### Steg 2: Backend - Sök i Registerbeteckning Direkt
- `registerbeteckning.service.ts` anropas
- **Request:** `GET /namn?namn=umeå tolvmansgården 4`
- **Auth:** Basic Auth med REGBET_CONSUMER_KEY/SECRET
- **Response:** `{ objektidentitet: "uuid-here", beteckning: "UMEÅ TOLVMANSGÅRDEN 4:1", ... }`

### Steg 3: Backend - Hämta geometri från OGC Features
- `lantmateriet.service.ts` anropas med objektidentitet
- **Request:** `GET /collections/registerenhetsomradesytor/items?objektidentitet=uuid-here`
- **Auth:** OAuth2 Bearer token
- **Response:** GeoJSON Feature med fastighetsgeometri

### Steg 4: Frontend
- Tar emot GeoJSON-polygon
- Sätter den som selected polygon i state
- Triggar automatiskt DeSO-matchning och datahämtning

## API Dokumentation

### Registerbeteckning Direkt API
- **Dokumentation:** https://geotorget.lantmateriet.se/dokumentation/GEODOK/11/latest.html
- **Sök efter namn:** `GET /distribution/produkter/registerbeteckning/v5/namn?namn={beteckning}`
- **Hämta via UUID:** `GET /distribution/produkter/registerbeteckning/v5/{objektidentitet}`
- **Autentisering:** Basic Auth med Consumer Key/Secret

### OGC Features API
- **API Spec:** https://api.lantmateriet.se/ogc-features/v1/fastighetsindelning/api
- **Collections:** https://api.lantmateriet.se/ogc-features/v1/fastighetsindelning/collections
- **Property Areas:** https://api.lantmateriet.se/ogc-features/v1/fastighetsindelning/collections/registerenhetsomradesytor/items
- **Autentisering:** OAuth2 Bearer token

## Autentisering

### Registerbeteckning Direkt - Basic Auth
```
GET https://api.lantmateriet.se/distribution/produkter/registerbeteckning/v5/namn?namn=...
Headers:
  Authorization: Basic base64(REGBET_CONSUMER_KEY:REGBET_CONSUMER_SECRET)
  Accept: application/json
```

Ingen token-hantering behövs - Basic Auth skickas med varje request.

### OGC Features - OAuth2 Flow
```
1. Backend anropar: POST https://apimanager.lantmateriet.se/oauth2/token
   Headers: Basic Auth (LM_CONSUMER_KEY:LM_CONSUMER_SECRET)
   Body: grant_type=client_credentials&scope=ogc-features:fastighetsindelning.read

2. Lantmäteriet returnerar:
   { "access_token": "...", "expires_in": 3600 }

3. Backend cachar token i minnet (expires_in - 60 sekunder)

4. Backend använder token för API-anrop:
   GET https://api.lantmateriet.se/ogc-features/v1/fastighetsindelning/...
   Headers: Authorization: Bearer <access_token>
```

## Felsökning

### "Fastigheten hittades inte"
- Kontrollera stavning och format: `KOMMUN TRAKT BLOCK:ENHET`
- Alla delar måste vara uppercase (konverteras automatiskt)
- Block och enhet är numeriska

### "Ett fel uppstod vid sökning. Har du lagt till API-nyckeln?"
- Kontrollera att `LM_CONSUMER_KEY` och `LM_CONSUMER_SECRET` är korrekt ifyllda i `.env`
- Kolla backend-logs för mer detaljerad felinfo
- Verifiera att du har prenumererat på rätt API i Lantmäteriets portal

### Backend loggar "Failed to authenticate with Lantmäteriet"
- Dubbelkolla Consumer Key och Secret
- Kontrollera att du har tillgång till scope `ogc-features:ngp.read`
- Testa credentials manuellt:
  ```bash
  curl -X POST https://api.lantmateriet.se/token \
    -u "CONSUMER_KEY:CONSUMER_SECRET" \
    -d "grant_type=client_credentials&scope=ogc-features:ngp.read"
  ```

### 401 Unauthorized
- Access token har löpt ut (borde inte hända, cachar med safety margin)
- Ogiltiga credentials
- Saknar rätt prenumeration i API-portalen

## Kostnader

Lantmäteriets API-prissättning varierar:
- **Gratistjänster:** Vissa API:er är gratis för test/utveckling
- **Betaltjänster:** Fastighetsinformation kan kräva prenumeration
- Kontakta Lantmäteriet för aktuella priser

## Säkerhet

⚠️ **VIKTIGT:**
- Lägg ALDRIG till `.env` i git (redan i `.gitignore`)
- Consumer Key och Secret är känsliga credentials
- Dela inte nycklar i issues, chat, eller offentliga repos
- Om nycklar läcker ut, regenerera dem i API-portalen

## Support

- **Lantmäteriet API-support:** https://www.lantmateriet.se/sv/Om-Lantmateriet/Kontakta-oss/
- **API-portal hjälp:** https://apim.lantmateriet.se/
- **Teknisk dokumentation:** https://www.lantmateriet.se/sv/geodata/vara-tjanster/

## Implementation Detaljer

### Filer som används

- **Backend:**
  - `/backend/src/services/registerbeteckning.service.ts` - Registerbeteckning Direkt API (sökning)
  - `/backend/src/services/lantmateriet.service.ts` - OGC Features API (geometrier) + orchestrator
  - `/backend/src/routes/properties.routes.ts` - Express routes
  - `/backend/.env` - Configuration

- **Frontend:**
  - `/frontend/src/components/PropertySearch.tsx` - UI component
  - `/frontend/src/services/api.ts` - API client

### Cache

- OAuth tokens cachar i minnet (expires_in - 60s)
- Fastighetsgeometrier cachar i DB (24h TTL)
- Cache-nyckel: `lantmateriet:property-{beteckning}`

### Stödda format

```
✅ KOMMUN TRAKT BLOCK:ENHET    (ex: NACKA SALTSJÖ-BOO 1:123)
✅ KOMMUN TRAKT BLOCK          (ex: UMEÅ CARLSLID 1)
❌ Fastighetsnyckel            (numerisk kod, stöds ej än)
❌ UUID                        (stöds ej än)
```

## Framtida Förbättringar

- [ ] Stöd för fastighetsnyckel (numerisk ID)
- [ ] Autocomplete vid sökning
- [ ] Visa fastighetsarea i UI
- [ ] Visa ägare/åborätt (kräver annan API-prenumeration)
- [ ] Batch-search för flera fastigheter
- [ ] Fallback till lokalt cachad geodata om API ej tillgängligt
