# Quick Analysis Guide

## Overview

Quick Analysis är ett förenklat analysläge som ger snabba go/no-go beslut för bostadsutvecklingsprojekt. Designat för att ge svar på 6 kritiska frågor på ~3 minuter och producera en 1-2 sidig visuellt tilltalande PDF-rapport.

## Vad Quick Analysis Gör

### Frågor som Besvaras

1. **Vem är målgruppen?** (Market Analyst)
2. **Hur ser bostadsbeståndet ut idag?** (Market Analyst)
3. **Vad säger försäljningsstatistiken?** (Market Analyst)
4. **Hur ser konkurrensen ut?** (Location Analyst + area_context)
5. **Hur är närhet till service?** (Location Analyst + area_context)
6. **Vilka framtida planer finns för området?** (Synthesizer)

Plus: **GO/NO-GO/MAYBE** rekommendation med rationale

### Arkitektur

```
Quick Analysis - 3 Agenter
===========================

Quick Market Analyst
  ↓ Outputs: Target demographic, housing gap, pricing

Quick Location Analyst
  ↓ Outputs: Location strengths/weaknesses, amenities, competition

Quick Synthesizer
  ↓ Outputs: Go/No-Go decision, insights, risks, next steps
```

## Användning

### Grundläggande Användning

```bash
# Med mock data
source venv/bin/activate
python quick_analysis.py --use-mock

# Med property designation
python quick_analysis.py --property "NACKA KVARNHOLMEN 1:1"

# Med location
python quick_analysis.py --location "Kvarnholmen, Nacka"

# Visa workflow diagram
python quick_analysis.py --show-workflow
```

### Avancerad Användning

```bash
# Custom output directory
python quick_analysis.py --property "UMEÅ TOLVMANSGÅRDEN 4" --output-dir quick_reports

# Skip PDF generation
python quick_analysis.py --use-mock --no-pdf

# Med egen input JSON
python quick_analysis.py --input data/my_project.json
```

## Input Data Requirements

### Minimal Input (för quick analysis)

```json
{
  "project_params": {
    "project_name": "Project Name",
    "location": "Location Name",
    "property_designation": "KOMMUN TRAKT ENHET",
    "project_size_units": 100
  },
  "input_data": {
    "demographic_data": {
      "total_population": 8450,
      "population_by_age": { ... },
      "economic_standard": { ... }
    },
    "housing_stock_data": {
      "units_by_size": { ... }
    },
    "sales_data": [ ... ],
    "price_history": { ... },
    "new_construction_data": [ ... ],
    "future_plans": [ "Plan 1", "Plan 2" ]
  }
}
```

### Area Context (Automatic)

Quick Analysis samlar automatiskt in area context data om location eller property_designation finns:
- Services inom 1km (skolor, butiker, restauranger, gym)
- Kollektivtrafik (närmaste hållplats, frekvens)
- Parker och rekreation
- Source från OSM, Trafiklab, Google Places

## Output

### Console Output

```
================================================================================
QUICK ANALYSIS SUMMARY
================================================================================

1. MARKET ANALYSIS:
   Status: COMPLETED
   Confidence: 0.85

   Target Demographic: Unga yrkesverksamma 25-35 år
   Match Score: 0.87

   Current Price Level: 85,000 kr/kvm
   Trend: RISING

2. LOCATION ANALYSIS:
   Status: COMPLETED
   Confidence: 0.82

   Overall Rating: EXCELLENT
   Location: Kvarnholmen, Nacka
   Amenity Score: 0.78
   Transit Quality: EXCELLENT

3. GO/NO-GO DECISION:
   Status: COMPLETED
   Confidence: 0.88

   ============================================================================
   RECOMMENDATION: GO
   Confidence: HIGH
   ============================================================================

   Rationale:
   Stark målgruppsmatch (0.87), utmärkt läge med kollektivtrafik,
   identifierad marknadsgap på moderna 1-2 ROK, begränsad konkurrens,
   stigande priser validerar marknaden.
```

### PDF Report (1-2 pages)

**Sida 1:**
- Project titel och datum
- **Stor GO/NO-GO decision box** (grön/röd/orange)
- Rationale
- Key metrics i grafiska boxar (2x3 grid):
  - Current Price + Trend
  - Target Match Score
  - Location Rating
  - Transit Access
  - Competition Level
  - Market Activity

**Sida 2:**
- Market Analysis sammanfattning
- Location & Amenities
- Key Insights (med impact icons)
- Key Risks & Mitigation
- Recommended Next Steps (prioriterade med färgmarkörer)
- Executive Summary

### Visual Design

PDF är designad för att vara:
- **Scannable** - Nyckeltal i boxar, tydliga rubriker
- **Visual** - Färgkodad go/no-go decision
- **Actionable** - Tydliga next steps med prioritet
- **Professional** - Clean layout, god typografi

## Agent Details

### 1. Quick Market Analyst

**Ansvar:**
- Identifiera och validera målgrupp
- Analysera bostadsbestånd och gaps
- Bedöma prisnivåer och trender

**Output:**
```json
{
  "target_demographic": { ... },
  "housing_stock_analysis": { ... },
  "pricing_analysis": {
    "current_price_level": { ... },
    "recommended_price_range": { ... }
  },
  "key_metrics": { ... }
}
```

### 2. Quick Location Analyst

**Ansvar:**
- Analysera läge och amenities (använder area_context)
- Bedöm konkurrens
- Identifiera styrkor/svagheter

**Output:**
```json
{
  "location_assessment": { ... },
  "amenities_analysis": {
    "transit_access": { ... },
    "services_within_1km": { ... },
    "amenity_score": 0.78
  },
  "competition_analysis": { ... },
  "location_strengths": [ ... ],
  "location_weaknesses": [ ... ]
}
```

### 3. Quick Synthesizer

**Ansvar:**
- Syntetisera insights från tidigare agenter
- Fatta go/no-go beslut
- Identifiera risker och next steps

**Output:**
```json
{
  "go_no_go_decision": {
    "recommendation": "GO/NO-GO/MAYBE",
    "confidence": "high/medium/low",
    "rationale": "...",
    "decision_factors": { ... }
  },
  "key_insights": [ ... ],
  "critical_success_factors": [ ... ],
  "key_risks": [ ... ],
  "next_steps": [ ... ],
  "executive_summary": "..."
}
```

## Decision Logic

### GO Criteria

Majoriteten av följande kriterier uppfyllda:
- ✅ Tydlig målgrupp finns i området (match >0.7)
- ✅ Identifierad market gap eller osatisfierad efterfrågan
- ✅ Prisläge stöder projektets ekonomi
- ✅ Låg-medel konkurrenstryck
- ✅ Bra läge med amenity score >0.6
- ✅ Positiva framtidsutsikter
- ✅ Inga kritiska blockers

### NO-GO Criteria

En eller flera kritiska faktorer:
- ❌ Ingen tydlig målgrupp i området
- ❌ Övermättad marknad (>500 konkurrerande units)
- ❌ Fallande priser eller låg aktivitet
- ❌ Dåligt läge (amenity score <0.3)
- ❌ Kritiska risker utan mitigation

### MAYBE Criteria

- 🟡 Blandade signaler
- 🟡 Potential finns men betydande risker
- 🟡 Måttlig konkurrens (kräver differentiering)
- 🟡 Begränsad data
- 🟡 Framtidsutsikter oklara

## Jämförelse: Quick vs Full Analysis

| Aspect | Quick Analysis | Full Analysis |
|--------|---------------|---------------|
| **Agenter** | 3 agenter | 11 agenter |
| **Frågor** | 6 frågor | 13 frågor |
| **Tid** | ~3 minuter | ~15-20 minuter |
| **Output** | 1-2 sidor PDF | 25-30 + 5-7 sidor PDF |
| **Use Case** | Go/no-go decision | Detaljerad planering |
| **Detalj** | Översiktlig | Djupgående |
| **Workflow** | Linear (Sequential) | Complex (Parallel + Review) |
| **Quality Control** | Ingen | QA agent + review loop |

## Best Practices

### När Använda Quick Analysis

✅ **Använd Quick Analysis när:**
- Snabb go/no-go bedömning behövs
- Tidigt i utvärderingsprocessen
- Flera projekt ska screenas
- Budget/resurser är begränsade
- Initial feasibility check

❌ **Använd INTE Quick Analysis när:**
- Detaljerad planering krävs
- Investeringsbeslut >50M SEK
- Komplexa projekt med många variabler
- Fullständig product mix behövs
- Presentation till styrelse/investerare

### Tips för Bäst Resultat

1. **Ge så mycket data som möjligt** - även för quick analysis
2. **Använd property designation** - ger bättre area context
3. **Inkludera future plans** - påverkar beslutet betydligt
4. **Följ upp GO med Full Analysis** - quick är bara första steget
5. **Använd MAYBE som trigger** - signal att mer analys behövs

## Troubleshooting

### "Area context not available"
- Kontrollera att location eller property_designation finns i project_params
- Verifiera API-nycklar för Google Places och Trafiklab

### "PDF generation failed"
- Kör med `--no-pdf` för att se JSON output ändå
- Kontrollera att reportlab är installerat: `pip install reportlab`

### "Quick Market/Location failed"
- Kontrollera ANTHROPIC_API_KEY
- Verifiera att input data har minimal required fields
- Kolla errors i output för detaljer

## Examples

### Exempel 1: Snabb screening av projekt

```bash
# Screena 3 olika områden snabbt
python quick_analysis.py --location "Hammarby Sjöstad" --output-dir screening/hammarby
python quick_analysis.py --location "Västra Hamnen, Malmö" --output-dir screening/malmo
python quick_analysis.py --location "Lindholmen, Göteborg" --output-dir screening/goteborg

# Jämför PDF:erna för go/no-go decisions
```

### Exempel 2: Från property designation

```bash
# Använd fastighetsbeteckning för exakt läge
python quick_analysis.py --property "NACKA KVARNHOLMEN 1:1" --output-dir nacka_quick

# Om GO → kör full analysis
python main.py --input nacka_quick/quick_analysis_*.json
```

### Exempel 3: Med egen data

```bash
# Skapa custom input JSON
cat > my_project.json << 'EOF'
{
  "project_params": {
    "project_name": "My Project",
    "location": "My Location",
    "project_size_units": 150
  },
  "input_data": {
    "demographic_data": { ... },
    ...
  }
}
EOF

# Kör quick analysis
python quick_analysis.py --input my_project.json
```

## Files Created

```
real_estate_analysis/
├── quick_analysis.py                         # Main entry point
├── agents/
│   ├── quick_market_analyst.py               # Market analysis agent
│   ├── quick_location_analyst.py             # Location analysis agent
│   └── quick_synthesizer.py                  # Synthesis & decision agent
├── graph/
│   └── quick_workflow.py                     # Quick workflow definition
├── prompts/templates/
│   ├── quick_market_analyst.md               # Market analyst prompt
│   ├── quick_location_analyst.md             # Location analyst prompt
│   └── quick_synthesizer.md                  # Synthesizer prompt
├── utils/
│   └── quick_pdf_generator.py                # Visual PDF generator
└── docs/
    └── QUICK_ANALYSIS_GUIDE.md               # This file
```

## Next Steps

Efter Quick Analysis visar GO eller MAYBE:

1. **Kör Full Analysis** - För detaljerad planering
2. **Uppdatera input data** - Med mer specifik projektdata
3. **Utveckla concept** - Baserat på quick insights
4. **Pre-market testing** - Validera antaganden
5. **Financial modeling** - Med pricing från quick analysis

## Support & Development

För frågor eller förbättringar:
- Läs full dokumentation i `/docs`
- Kolla prompts i `/prompts/templates/quick_*.md`
- Test med `--show-workflow` och `--use-mock`
- Justera confidence thresholds i agent-kod vid behov
