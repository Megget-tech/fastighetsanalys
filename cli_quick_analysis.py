#!/usr/bin/env python3
"""
CLI for Quick Analysis - designed for integration with external applications.

Usage:
    python cli_quick_analysis.py --input data.json --output result.json
    python cli_quick_analysis.py --input data.json --nyproduktion projects.xlsx --output result.json --pdf report.pdf

Input JSON format (from data collection):
{
    "metadata": {
        "kommun": "Umeå",
        "property_name": "Umeå Tolvmansgården 4",
        "coordinates": {"latitude": 63.836, "longitude": 20.194},
        "deso_codes": ["2480C1310"]
    },
    "metrics": { ... },
    "booli_data": { ... }
}
"""
import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

import pandas as pd
from dotenv import load_dotenv

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from graph.quick_workflow import create_quick_workflow
from graph.state import create_initial_state
from utils.area_context_collector import AreaContextCollector
from utils.map_generator import MapGenerator


def load_json_data(json_path: str) -> dict:
    """Load JSON data from file."""
    with open(json_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_new_construction_from_excel(excel_path: str) -> list:
    """Load and convert Excel new construction data to JSON format."""
    df = pd.read_excel(excel_path)

    # Filter out summary row and rows without project names
    if 'Namn' in df.columns:
        df = df[df['Namn'].notna() & (df['Namn'] != 'Summa')]

    # Filter to only active projects if 'Fas' column exists
    if 'Fas' in df.columns:
        df = df[df['Fas'] == 'Under försäljning'].copy()

    projects = []
    for _, row in df.iterrows():
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


def run_quick_analysis(
    input_data: dict,
    new_construction: list = None,
    collect_area_context: bool = True,
    generate_map: bool = True,
    output_dir: Path = None
) -> dict:
    """
    Run quick analysis on input data.

    Args:
        input_data: JSON data from data collection
        new_construction: Optional list of competing projects
        collect_area_context: Whether to collect area context from APIs
        generate_map: Whether to generate a map image
        output_dir: Directory for output files (map, etc.)

    Returns:
        Analysis result dictionary
    """
    load_dotenv()

    # Check API key
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return {"error": "ANTHROPIC_API_KEY not configured"}

    metadata = input_data.get("metadata", {})

    # Create project params
    project_params = {
        "project_name": metadata.get("property_name", "Quick Analysis"),
        "location": metadata.get("kommun", "Unknown"),
        "property_designation": metadata.get("property_name"),
        "coordinates": metadata.get("coordinates"),
        "analysis_date": datetime.now().strftime("%Y-%m-%d")
    }

    # Add new construction to data
    if new_construction:
        input_data["new_construction"] = new_construction

    # Collect area context if requested
    area_context = None
    if collect_area_context:
        coords = metadata.get('coordinates', {})
        if coords and (coords.get('latitude') or coords.get('lat')):
            try:
                area_collector = AreaContextCollector()
                kommun = metadata.get('kommun', '')
                destinations = [f"{kommun} centrum", f"{kommun} centralstation"] if kommun else None

                area_context = area_collector.collect(
                    property_designation=metadata.get('property_name'),
                    radius_m=1000,
                    destinations=destinations
                )

                if area_context and 'error' in area_context:
                    area_context = None
            except Exception as e:
                print(f"Warning: Could not collect area context: {e}", file=sys.stderr)

    # Generate map if requested
    map_path = None
    if generate_map and area_context and output_dir:
        try:
            map_gen = MapGenerator()
            if map_gen.is_available():
                loc_coords = area_context.get('location', {}).get('coordinates')
                lat, lon = None, None
                if isinstance(loc_coords, (list, tuple)) and len(loc_coords) >= 2:
                    lat, lon = loc_coords[0], loc_coords[1]
                elif isinstance(loc_coords, dict):
                    lat = loc_coords.get('lat') or loc_coords.get('latitude')
                    lon = loc_coords.get('lon') or loc_coords.get('longitude')

                if lat and lon:
                    safe_name = metadata.get('property_name', 'analysis').replace(' ', '_').replace('/', '_')
                    map_output_path = output_dir / f"map_{safe_name}.png"
                    map_path = map_gen.generate_area_map(
                        center_coords=(lat, lon),
                        area_context=area_context,
                        output_path=str(map_output_path),
                        zoom=15
                    )
        except Exception as e:
            print(f"Warning: Could not generate map: {e}", file=sys.stderr)

    # Create initial state
    initial_state = create_initial_state({}, project_params)
    initial_state["input_data"] = input_data
    initial_state["project_params"] = project_params
    initial_state["area_context"] = area_context

    # Run workflow
    workflow = create_quick_workflow()
    final_state = workflow.invoke(initial_state)

    # Add map path to result
    if map_path:
        final_state["map_path"] = str(map_path)

    return final_state


def main():
    parser = argparse.ArgumentParser(
        description='Run Quick Analysis on real estate data',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python cli_quick_analysis.py --input data.json --output result.json
    python cli_quick_analysis.py --input data.json --nyproduktion projects.xlsx --output result.json
    python cli_quick_analysis.py --input data.json --output result.json --pdf report.pdf --no-area-context
        """
    )

    parser.add_argument('--input', '-i', required=True, help='Input JSON file (from data collection)')
    parser.add_argument('--nyproduktion', '-n', help='Excel file with new construction projects')
    parser.add_argument('--output', '-o', required=True, help='Output JSON file for results')
    parser.add_argument('--pdf', '-p', help='Output PDF report path')
    parser.add_argument('--no-area-context', action='store_true', help='Skip area context collection')
    parser.add_argument('--no-map', action='store_true', help='Skip map generation')

    args = parser.parse_args()

    # Validate input file
    input_path = Path(args.input)
    if not input_path.exists():
        print(json.dumps({"error": f"Input file not found: {args.input}"}))
        sys.exit(1)

    # Load input data
    try:
        input_data = load_json_data(args.input)
    except Exception as e:
        print(json.dumps({"error": f"Failed to load input JSON: {str(e)}"}))
        sys.exit(1)

    # Load new construction data if provided
    new_construction = None
    if args.nyproduktion:
        nyp_path = Path(args.nyproduktion)
        if not nyp_path.exists():
            print(json.dumps({"error": f"Nyproduktion file not found: {args.nyproduktion}"}))
            sys.exit(1)
        try:
            new_construction = load_new_construction_from_excel(args.nyproduktion)
        except Exception as e:
            print(json.dumps({"error": f"Failed to load nyproduktion Excel: {str(e)}"}))
            sys.exit(1)

    # Determine output directory
    output_path = Path(args.output)
    output_dir = output_path.parent
    output_dir.mkdir(parents=True, exist_ok=True)

    # Run analysis
    print("Running quick analysis...", file=sys.stderr)
    result = run_quick_analysis(
        input_data=input_data,
        new_construction=new_construction,
        collect_area_context=not args.no_area_context,
        generate_map=not args.no_map,
        output_dir=output_dir
    )

    # Save JSON result
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False, default=str)

    print(f"Results saved to: {args.output}", file=sys.stderr)

    # Generate PDF if requested
    if args.pdf:
        try:
            from generate_pdf_report import generate_pdf
            pdf_path = generate_pdf(args.output, args.pdf)
            print(f"PDF report saved to: {pdf_path}", file=sys.stderr)
            result["pdf_path"] = pdf_path
        except Exception as e:
            print(f"Warning: Failed to generate PDF: {e}", file=sys.stderr)

    # Output result summary to stdout (for Node.js to capture)
    summary = {
        "status": "completed" if "error" not in result else "error",
        "output_file": str(output_path),
        "pdf_file": args.pdf if args.pdf else None,
        "map_file": result.get("map_path"),
    }

    # Extract key results
    if result.get("quick_synthesis_output"):
        synthesis = result["quick_synthesis_output"].get("output", {})
        decision = synthesis.get("go_no_go_decision", {})
        summary["recommendation"] = decision.get("recommendation")
        summary["confidence"] = decision.get("confidence")
        summary["rationale"] = decision.get("rationale")

    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
