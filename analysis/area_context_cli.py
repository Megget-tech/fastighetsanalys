#!/usr/bin/env python3
"""
Area Context CLI Tool
Standalone tool for collecting area context data.

Usage:
    python area_context_cli.py --location "Kvarnholmen, Nacka" --output data/area_context.json
"""
import argparse
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from utils.area_context_collector import AreaContextCollector


def main():
    """Main CLI function."""
    parser = argparse.ArgumentParser(
        description="Collect area context data for real estate analysis",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --location "Kvarnholmen, Nacka"
  %(prog)s --location "Hammarby Sjöstad, Stockholm" --output hammarby_context.json
  %(prog)s --location "Centrala Göteborg" --radius 2000 --destinations "Göteborg C" "Nordstan"
  %(prog)s --location "Malmö Västra Hamnen" --future-plans "Ny metrolinje 2028" "Skola öppnar 2025"
        """
    )

    parser.add_argument(
        "--location",
        help="Location name or address (e.g., 'Kvarnholmen, Nacka')"
    )

    parser.add_argument(
        "--property", "-p",
        dest="property_designation",
        help="Property designation (e.g., 'UMEÅ TOLVMANSGÅRDEN 4')"
    )

    parser.add_argument(
        "--output", "-o",
        default="area_context.json",
        help="Output file path (default: area_context.json)"
    )

    parser.add_argument(
        "--radius", "-r",
        type=int,
        default=1000,
        help="Search radius in meters (default: 1000)"
    )

    parser.add_argument(
        "--destinations", "-d",
        nargs="*",
        help="Destinations for travel time calculations (e.g., 'Stockholm C' 'Slussen')"
    )

    parser.add_argument(
        "--future-plans", "-f",
        nargs="*",
        help="Future development plans/visions for the area"
    )

    parser.add_argument(
        "--google-api-key",
        help="Google Places API key (overrides env variable)"
    )

    parser.add_argument(
        "--trafiklab-api-key",
        help="Trafiklab API key (overrides env variable)"
    )

    parser.add_argument(
        "--lantmateriet-api-key",
        help="Lantmäteriet API key (overrides env variable)"
    )

    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print JSON output"
    )

    args = parser.parse_args()

    # Validate that either location or property_designation is provided
    if not args.location and not args.property_designation:
        parser.error("Either --location or --property must be provided")

    # Initialize collector
    try:
        collector = AreaContextCollector(
            google_api_key=args.google_api_key,
            trafiklab_api_key=args.trafiklab_api_key,
            lantmateriet_api_key=args.lantmateriet_api_key
        )
    except Exception as e:
        print(f"\n❌ Failed to initialize Area Context Collector: {str(e)}")
        return 1

    # Collect data
    try:
        area_context = collector.collect(
            location=args.location,
            property_designation=args.property_designation,
            radius_m=args.radius,
            destinations=args.destinations,
            future_plans=args.future_plans
        )
    except Exception as e:
        print(f"\n❌ Failed to collect area context: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

    # Check for errors
    if "error" in area_context:
        print(f"\n❌ Error: {area_context['error']}")
        return 1

    # Save to file
    try:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            if args.pretty:
                json.dump(area_context, f, indent=2, ensure_ascii=False)
            else:
                json.dump(area_context, f, ensure_ascii=False)

        print(f"\n✓ Area context saved to: {output_path}")
        print(f"\n📊 Summary:")
        print(f"   {area_context.get('summary', 'No summary available')}")

        # Print key stats
        services = area_context.get("services_within_1km", {})
        transit = area_context.get("transit_access", {})

        print(f"\n🏫 Services within {args.radius}m:")
        print(f"   Schools: {services.get('education', {}).get('schools', 0)}")
        print(f"   Supermarkets: {services.get('retail', {}).get('supermarkets', 0)}")
        print(f"   Restaurants: {services.get('dining', {}).get('restaurants', 0)}")
        print(f"   Cafes: {services.get('dining', {}).get('cafes', 0)}")
        print(f"   Gyms: {services.get('fitness', {}).get('gyms', 0)}")

        if transit.get("available"):
            print(f"\n🚌 Transit:")
            closest = transit.get("closest_stop", {})
            if closest:
                print(f"   Closest stop: {closest.get('name')} ({closest.get('distance_m')}m)")

            freq = transit.get("frequency_analysis", {})
            if freq:
                print(f"   Frequency: {freq.get('description', 'N/A')}")

            travel_times = transit.get("travel_times", {})
            if travel_times:
                print(f"\n🕐 Travel times:")
                for dest, data in travel_times.items():
                    print(f"   {data.get('destination')}: {data.get('duration_min')} min ({data.get('transfers')} transfers)")

        print("\n")
        return 0

    except Exception as e:
        print(f"\n❌ Failed to save output: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
