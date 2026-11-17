# Real Estate Analysis System

Multi-agent system for automated residential development project analysis using LangGraph and Claude Sonnet 4.

## Overview

This system analyzes real estate market data to produce comprehensive reports for residential development projects. It uses a multi-agent architecture where specialized agents work together to analyze demographics, market data, competition, pricing, and product mix.

The system supports two analysis modes:
- **Quick Analysis**: Fast go/no-go assessment (1-2 pages, ~3 minutes)
- **Full Analysis**: Comprehensive market analysis with dual report formats (full 25-30 pages + executive 5-7 pages)

## Key Features

- **Multi-Agent Analysis**: 11 specialized agents orchestrated through LangGraph
- **Automated Area Context Collection**: Automatic gathering of location data via OpenStreetMap, Trafiklab, and Google Places
- **Segment Matching**: Intelligent matching of demographics to target audience segments
- **Dual Report Generation**: Full comprehensive reports + executive summaries
- **Professional PDF Output**: Styled reports with tables, sections, and visualizations

## Architecture

The system consists of 11 specialized agents orchestrated through LangGraph:

### Workflow Phases

1. **Phase 1**: Data Validation & Distribution (Orchestrator)
2. **Phase 2**: Parallel Market Analysis (Demographics, Market Data, Competition)
3. **Phase 3**: Synthesis & Insights (Migration, Market Intelligence)
4. **Phase 4**: Strategic Recommendations (Pricing, Product Mix)
5. **Phase 5**: Quality & Synthesis (Synthesis Analyst, Quality Controller)
6. **Phase 6**: Report Generation (Report Writer)

### Area Context Collection

Automated data collection from multiple sources:
- **Lantmäteriet** (optional): Convert property designation (fastighetsbeteckning) to coordinates
- **OpenStreetMap**: Infrastructure, public services, nature areas
- **Trafiklab (ResRobot)**: Public transit frequency, nearby stops
- **Google Places** (optional): Commercial services, restaurants, gyms with ratings

The system accepts either a location string (e.g., "Kvarnholmen, Nacka") or a Swedish property designation (e.g., "NACKA KVARNHOLMEN 1:1"). If Lantmäteriet API is configured, property designations are converted to exact coordinates. Otherwise, a fallback geocoding mechanism is used.

## Installation

### Prerequisites

- Python 3.10 or higher
- Poetry
- Anthropic API key

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   cd real_estate_analysis
   poetry install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Add your API keys to `.env`:
   ```
   ANTHROPIC_API_KEY=your_key_here
   GOOGLE_PLACES_API_KEY=your_google_key_here      # Optional, for enhanced commercial data
   TRAFIKLAB_API_KEY=your_trafiklab_key_here        # Optional, for transit data
   LANTMATERIET_API_KEY=your_lantmateriet_key_here  # Optional, for property designation lookup
   ```

## Usage

### Full Analysis
```bash
# With mock data
poetry run python main.py --use-mock

# With real data
poetry run python main.py --input data/input/project_data.json

# With automatic area context collection
poetry run python main.py --use-mock --auto-area-context
```

### Quick Analysis
```bash
# Fast go/no-go analysis (1-2 pages)
poetry run python quick_analysis.py --location "Kvarnholmen, Nacka"
```

### Area Context Collection (Standalone)
```bash
# Generate area context by location
poetry run python area_context_cli.py --location "Kvarnholmen, Nacka" --output data/area_context.json

# Generate area context by property designation (fastighetsbeteckning)
poetry run python area_context_cli.py --property "NACKA KVARNHOLMEN 1:1" --output data/area_context.json --pretty

# With custom radius and destinations
poetry run python area_context_cli.py --property "UMEÅ TOLVMANSGÅRDEN 4" --radius 1500 --destinations "Umeå C" "Vasaplan"
```

## Project Structure

```
real_estate_analysis/
├── agents/                          # Agent implementations
│   ├── base_agent.py                # Base agent class
│   ├── orchestrator.py              # Data validation & orchestration
│   ├── demographics_analyst.py      # Demographics analysis
│   ├── market_data_analyst.py       # Market data analysis
│   ├── competition_analyst.py       # Competition analysis
│   ├── migration_analyst.py         # Migration patterns analysis
│   ├── market_intelligence_synthesizer.py  # Market insights
│   ├── pricing_strategist.py        # Pricing recommendations
│   ├── product_mix_optimizer.py     # Product mix optimization
│   ├── synthesis_analyst.py         # Strategic synthesis
│   ├── quality_controller.py        # Quality assurance
│   └── report_writer.py             # Report generation
├── graph/                           # LangGraph workflow definitions
│   ├── state.py                     # Workflow state management
│   └── workflow.py                  # Workflow orchestration
├── prompts/                         # Prompt templates
│   └── templates/                   # Agent-specific prompts
├── utils/                           # Utility functions
│   ├── area_context_collector.py    # Area context data collection
│   ├── osm_client.py                # OpenStreetMap client
│   ├── trafiklab_client.py          # Trafiklab API client
│   ├── google_places_client.py      # Google Places client
│   └── pdf_generator.py             # PDF report generation
├── tests/                           # Test suite
├── data/                            # Input/output data
│   ├── input/                       # Input data files
│   ├── output/                      # Generated reports (JSON + PDF)
│   └── mock/                        # Mock data for testing
├── docs/                            # Documentation
│   ├── segmentskort_peab.json       # Target audience segments
│   └── analysis_requirements_revised.md  # Analysis requirements
├── main.py                          # Full analysis entry point
├── quick_analysis.py                # Quick analysis entry point (TODO)
└── area_context_cli.py              # Standalone area context tool (TODO)
```

## Development

Run tests:
```bash
poetry run pytest
```

Format code:
```bash
poetry run black .
poetry run ruff check .
```

## License

Proprietary
