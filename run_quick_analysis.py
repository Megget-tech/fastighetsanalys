#!/usr/bin/env python3
"""
Run Quick Analysis with new data format (metrics + booli_data).
"""
import os
import json
import sys
import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def load_json_data(json_path: str) -> Dict[str, Any]:
    """Load JSON data from file."""
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_new_construction_from_excel(excel_path: str) -> list:
    """
    Load and convert Excel new construction data to JSON format.

    Expected columns:
    - Namn, Område, Bostadsutvecklare, Antal bostäder (st),
    - Antal sålda bostäder (st), Pris per kvadratmeter (kr/m²), etc.
    """
    df = pd.read_excel(excel_path)

    # Filter out summary row and rows without project names
    df = df[df['Namn'].notna() & (df['Namn'] != 'Summa')]

    # Filter to only "Under försäljning" projects
    df_active = df[df['Fas'] == 'Under försäljning'].copy()

    projects = []
    for _, row in df_active.iterrows():
        project = {
            "project_name": row.get('Namn', ''),
            "area": row.get('Område', ''),
            "developer": row.get('Bostadsutvecklare', 'Okänd'),
            "total_units": int(row.get('Antal bostäder (st)', 0)) if pd.notna(row.get('Antal bostäder (st)')) else 0,
            "units_for_sale": int(row.get('Antal bostäder till salu (st)', 0)) if pd.notna(row.get('Antal bostäder till salu (st)')) else 0,
            "units_sold": int(row.get('Antal sålda bostäder (st)', 0)) if pd.notna(row.get('Antal sålda bostäder (st)')) else 0,
            "average_price": int(row.get('Medelpris (kr)', 0)) if pd.notna(row.get('Medelpris (kr)')) else 0,
            "price_per_sqm": int(row.get('Pris per kvadratmeter (kr/m²)', 0)) if pd.notna(row.get('Pris per kvadratmeter (kr/m²)')) else 0,
            "yearly_fee_per_sqm": int(row.get('Årsavgift (kr/m²/år)', 0)) if pd.notna(row.get('Årsavgift (kr/m²/år)')) else 0,
            "sales_start": str(row.get('Säljstart', '')) if pd.notna(row.get('Säljstart')) else None,
            "status": row.get('Fas', '')
        }

        # Calculate sales percentage
        if project['total_units'] > 0:
            project['sales_percentage'] = round(100 * project['units_sold'] / project['total_units'], 1)
        else:
            project['sales_percentage'] = 0

        projects.append(project)

    return projects


def print_summary(state: Dict[str, Any]) -> None:
    """Print analysis summary."""
    print("\n" + "="*80)
    print("QUICK ANALYSIS RESULTAT")
    print("="*80)

    # Market Analysis
    if state.get("quick_market_output"):
        market = state["quick_market_output"]
        print("\n📊 MARKNADSANALYS")
        print(f"   Status: {market.get('status', 'unknown').upper()}")
        print(f"   Confidence: {market.get('confidence_score', 0):.2f}")

        if "output" in market:
            output = market["output"]

            # Target demographic
            if "target_demographic" in output:
                target = output["target_demographic"]
                print(f"\n   Målgrupp: {target.get('primary_segment', 'N/A')}")
                print(f"   Match Score: {target.get('match_score', 0):.2f}")
                print(f"   Beskrivning: {target.get('description', 'N/A')}")

            # Pricing
            if "pricing_analysis" in output:
                pricing = output["pricing_analysis"]
                current = pricing.get("current_price_level", {})
                print(f"\n   Prisnivå: {current.get('average_sqm_price', 0):,} kr/kvm")
                print(f"   Trend: {current.get('trend', 'unknown').upper()}")

                recommended = pricing.get("recommended_price_range", {})
                if recommended:
                    print(f"   Rekommenderat pris: {recommended.get('low', 0):,} - {recommended.get('high', 0):,} kr/kvm")

    # Location Analysis
    if state.get("quick_location_output"):
        location = state["quick_location_output"]
        print("\n📍 LÄGESANALYS")
        print(f"   Status: {location.get('status', 'unknown').upper()}")
        print(f"   Confidence: {location.get('confidence_score', 0):.2f}")

        if "output" in location:
            output = location["output"]

            if "location_assessment" in output:
                loc = output["location_assessment"]
                print(f"\n   Betyg: {loc.get('overall_rating', 'unknown').upper()}")
                print(f"   Beskrivning: {loc.get('description', 'N/A')}")

            if "competition_analysis" in output:
                comp = output["competition_analysis"]
                if comp.get("data_available"):
                    details = comp.get("if_available", {})
                    print(f"\n   Konkurrerande projekt: {details.get('total_competing_units', 0)} lägenheter")
                    print(f"   Marknadsmättnad: {details.get('market_saturation', 'unknown').upper()}")

    # Synthesis / Go-No-Go
    if state.get("quick_synthesis_output"):
        synthesis = state["quick_synthesis_output"]
        print("\n🎯 SLUTSATS & REKOMMENDATION")
        print(f"   Status: {synthesis.get('status', 'unknown').upper()}")
        print(f"   Confidence: {synthesis.get('confidence_score', 0):.2f}")

        if "output" in synthesis:
            output = synthesis["output"]

            if "go_no_go_decision" in output:
                decision = output["go_no_go_decision"]
                rec = decision.get("recommendation", "UNKNOWN")

                print(f"\n   {'='*70}")
                if rec == "GO":
                    print(f"   ✅ REKOMMENDATION: {rec}")
                elif rec == "NO-GO":
                    print(f"   ❌ REKOMMENDATION: {rec}")
                else:
                    print(f"   ⚠️  REKOMMENDATION: {rec}")
                print(f"   Konfidensgrad: {decision.get('confidence', 'unknown').upper()}")
                print(f"   {'='*70}")
                print(f"\n   Motivering: {decision.get('rationale', 'N/A')}")

            # Pricing guidance
            if "pricing_guidance" in output:
                pricing = output["pricing_guidance"]
                price_range = pricing.get("recommended_range_per_sqm", {})
                print(f"\n   💰 PRISREKOMMENDATION:")
                print(f"   Intervall: {price_range.get('low', 0):,} - {price_range.get('high', 0):,} kr/kvm")
                print(f"   Positionering: {pricing.get('positioning', 'N/A')}")
                print(f"   Motivering: {pricing.get('rationale', 'N/A')}")

            # Product mix guidance
            if "product_mix_guidance" in output:
                mix = output["product_mix_guidance"]
                print(f"\n   🏠 PRODUKTMIX-REKOMMENDATION:")
                print(f"   Fokus: {mix.get('recommended_focus', 'N/A')}")
                suggested = mix.get("suggested_distribution", {})
                if suggested:
                    print(f"   Fördelning: 1rok: {suggested.get('1rok', 'N/A')}, 2rok: {suggested.get('2rok', 'N/A')}, 3rok: {suggested.get('3rok', 'N/A')}, 4rok+: {suggested.get('4rok+', 'N/A')}")

            # Executive summary
            if "executive_summary" in output:
                print(f"\n   📝 SAMMANFATTNING:")
                print(f"   {output['executive_summary']}")

            # Next steps
            if "next_steps" in output:
                print(f"\n   📋 NÄSTA STEG:")
                for i, step in enumerate(output["next_steps"][:3], 1):
                    print(f"   {i}. [{step.get('priority', 'medium').upper()}] {step.get('action', 'N/A')}")

    # Warnings
    if state.get("warnings"):
        print("\n⚠️  VARNINGAR:")
        for warning in state["warnings"][:5]:
            print(f"   - {warning}")

    # Execution time
    if state.get("agent_execution_times"):
        total = sum(state["agent_execution_times"].values())
        print(f"\n⏱️  Total tid: {total:.1f}s")

    print("\n" + "="*80)


def main():
    """Main function to run quick analysis."""
    print("\n" + "="*80)
    print("QUICK ANALYSIS - Umeå Tolvmansgården 4")
    print("="*80)

    # Check API key
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("\n❌ ANTHROPIC_API_KEY saknas i miljövariabler")
        return 1

    # File paths
    base_path = Path(__file__).parent
    json_path = base_path / "data/input/Umeå Tolvmansgården 4.json"
    excel_path = base_path / "data/input/Nyproduktionsprojekt Umeå 260115.xlsx"
    output_dir = base_path / "data/quick_output"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Load JSON data
    print(f"\n📂 Laddar data från {json_path.name}...")
    data = load_json_data(json_path)

    metadata = data.get("metadata", {})
    print(f"   Kommun: {metadata.get('kommun')}")
    print(f"   Fastighet: {metadata.get('property_name')}")
    print(f"   Koordinater: {metadata.get('coordinates')}")

    # Load new construction data
    print(f"\n📂 Laddar nyproduktionsdata från {excel_path.name}...")
    new_construction = load_new_construction_from_excel(excel_path)
    print(f"   Hittade {len(new_construction)} aktiva projekt")

    for proj in new_construction[:3]:
        print(f"   - {proj['project_name']}: {proj['units_sold']}/{proj['total_units']} sålda ({proj['sales_percentage']}%), {proj['price_per_sqm']:,} kr/kvm")
    if len(new_construction) > 3:
        print(f"   ... och {len(new_construction) - 3} till")

    # Add new construction to data
    data["new_construction"] = new_construction

    # Create project params
    project_params = {
        "project_name": metadata.get("property_name", "Quick Analysis"),
        "location": f"{metadata.get('kommun', 'Unknown')}",
        "property_designation": metadata.get("property_name"),
        "coordinates": metadata.get("coordinates"),
        "analysis_date": datetime.now().strftime("%Y-%m-%d")
    }

    # Import workflow components
    print("\n⚙️  Initierar workflow...")
    from graph.quick_workflow import create_quick_workflow
    from graph.state import create_initial_state
    from utils.area_context_collector import AreaContextCollector
    from utils.map_generator import MapGenerator

    # Collect area context data
    print("\n🌍 Samlar in områdeskontext...")
    area_collector = AreaContextCollector()

    # Determine destinations based on municipality
    kommun = metadata.get('kommun', 'Umeå')
    destinations = [f"{kommun} centrum", f"{kommun} centralstation"]

    # Get coordinates from metadata
    coords = metadata.get('coordinates', {})

    area_context = None
    if coords and coords.get('latitude') and coords.get('longitude'):
        area_context = area_collector.collect(
            property_designation=metadata.get('property_name'),
            radius_m=1000,
            destinations=destinations
        )
        if area_context and 'error' not in area_context:
            print(f"   ✓ Områdeskontext insamlad: {area_context.get('summary', 'N/A')[:100]}...")
        else:
            print(f"   ⚠️  Kunde inte samla in områdeskontext: {area_context.get('error', 'Okänt fel')}")
            area_context = None
    else:
        print("   ⚠️  Koordinater saknas - hoppar över områdeskontext")

    # Generate map if area context is available
    map_path = None
    if area_context and 'error' not in area_context:
        print("\n🗺️  Genererar karta...")
        map_gen = MapGenerator()
        if map_gen.is_available():
            # Get coordinates from area context
            loc_coords = area_context.get('location', {}).get('coordinates')
            lat, lon = None, None
            if isinstance(loc_coords, (list, tuple)) and len(loc_coords) >= 2:
                lat, lon = loc_coords[0], loc_coords[1]
            elif isinstance(loc_coords, dict):
                lat = loc_coords.get('lat') or loc_coords.get('latitude')
                lon = loc_coords.get('lon') or loc_coords.get('longitude')
            if lat and lon:
                map_output_path = output_dir / f"map_{metadata.get('property_name', 'analysis').replace(' ', '_')}.png"
                map_path = map_gen.generate_area_map(
                    center_coords=(lat, lon),
                    area_context=area_context,
                    output_path=str(map_output_path),
                    zoom=15
                )
        else:
            print("   ⚠️  Google Maps API ej konfigurerad - hoppar över karta")

    # Create initial state with new format
    initial_state = create_initial_state({}, project_params)

    # Override with actual data in new format
    initial_state["input_data"] = data
    initial_state["project_params"] = project_params
    initial_state["area_context"] = area_context

    # Create and run workflow
    print("\n🚀 Kör quick analysis...")
    print("-" * 80)

    workflow = create_quick_workflow()
    final_state = workflow.invoke(initial_state)

    # Print summary
    print_summary(final_state)

    # Add map path to state for PDF generation
    if map_path:
        final_state["map_path"] = str(map_path)

    # Save output
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = output_dir / f"quick_analysis_tolvmansgarden_{timestamp}.json"

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(final_state, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n✅ Resultat sparat till: {output_path}")
    if map_path:
        print(f"🗺️  Karta sparad till: {map_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
