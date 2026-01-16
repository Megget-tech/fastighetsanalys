"""
Mini-test: Generate map with area context data for a property
No analysis or reports - just data collection and map visualization
"""
import os
import json
from utils.area_context_collector import AreaContextCollector
from utils.map_generator import MapGenerator


def test_map_with_context():
    """Test map generation with area context data"""

    print("=" * 80)
    print("MINI-TEST: Kartbild med Områdesdata")
    print("=" * 80)

    # Get API keys from environment
    google_api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    trafiklab_api_key = os.getenv("TRAFIKLAB_API_KEY")
    lantmateriet_api_key = os.getenv("LANTMATERIET_API_KEY")
    lantmateriet_api_secret = os.getenv("LANTMATERIET_API_SECRET")

    # Initialize collectors
    print("\n🔧 Initializing collectors...")
    area_collector = AreaContextCollector(
        google_api_key=google_api_key,
        trafiklab_api_key=trafiklab_api_key,
        lantmateriet_api_key=lantmateriet_api_key,
        lantmateriet_api_secret=lantmateriet_api_secret
    )

    map_generator = MapGenerator(api_key=google_api_key)

    # Collect area context data
    print("\n📊 Collecting area context data...")

    # Use property designation to get exact location from Lantmäteriet
    area_context = area_collector.collect(
        property_designation="UMEÅ TOLVMANSGÅRDEN 4",
        radius_m=1000,
        destinations=["Umeå centrum", "Umeå Universitetssjukhus"]
    )

    # Check if we got data
    if "error" in area_context:
        print(f"\n❌ Error: {area_context['error']}")
        return

    # Display collected data summary
    print("\n" + "=" * 80)
    print("COLLECTED DATA SUMMARY")
    print("=" * 80)

    location = area_context.get("location", {})
    print(f"\n📍 Location: {location.get('name')}")
    print(f"   Coordinates: {location.get('coordinates')}")
    print(f"   Municipality: {location.get('municipality')}")

    services = area_context.get("services_within_1km", {})
    print(f"\n🏫 Services within 1km:")
    print(f"   Schools: {services.get('education', {}).get('schools', 0)}")
    print(f"   Supermarkets: {services.get('retail', {}).get('supermarkets', 0)}")
    print(f"   Restaurants: {services.get('dining', {}).get('restaurants', 0)}")
    print(f"   Cafes: {services.get('dining', {}).get('cafes', 0)}")
    print(f"   Gyms: {services.get('fitness', {}).get('gyms', 0)}")

    transit = area_context.get("transit_access", {})
    if transit.get("available"):
        print(f"\n🚌 Transit Access:")
        closest_stop = transit.get("closest_stop", {})
        if closest_stop:
            print(f"   Closest stop: {closest_stop.get('name')} ({closest_stop.get('distance_m')}m)")
            print(f"   Lines: {', '.join(closest_stop.get('lines', []))}")

        freq = transit.get("frequency_analysis", {})
        if freq:
            print(f"   Frequency: {freq.get('description')}")

        travel_times = transit.get("travel_times", {})
        if travel_times:
            print(f"   Travel times:")
            for dest, data in travel_times.items():
                print(f"      → {dest}: {data.get('duration_min')} min ({data.get('distance_text')})")

    data_sources = area_context.get("data_sources", {})
    print(f"\n📊 Data Sources:")
    print(f"   OSM: {'✅' if data_sources.get('osm') else '❌'}")
    print(f"   Trafiklab: {'✅' if data_sources.get('trafiklab') else '❌'}")
    print(f"   Google Places: {'✅' if data_sources.get('google_places') else '❌'}")
    print(f"   Google Distance Matrix: {'✅' if data_sources.get('google_distance_matrix') else '❌'}")

    # Generate map with all context data
    print("\n" + "=" * 80)
    print("GENERATING MAP")
    print("=" * 80)

    coords = location.get("coordinates")
    if not coords:
        print("\n❌ No coordinates available for map generation")
        return

    print(f"\n🗺️  Generating map for {location.get('name')}...")

    # Generate map using area_context
    output_path = "/Users/patrikpettersson/Documents/fanalys/real_estate_analysis/test_map_output.png"

    try:
        map_path = map_generator.generate_area_map(
            center_coords=coords,
            area_context=area_context,
            output_path=output_path,
            zoom=14,
            width=800,
            height=600
        )

        print(f"\n✅ Map generated successfully!")
        print(f"   Saved to: {map_path}")

    except Exception as e:
        print(f"\n❌ Map generation failed: {str(e)}")

    # Save area context data to JSON
    json_path = "test_area_context.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(area_context, f, indent=2, ensure_ascii=False)

    print(f"\n💾 Area context data saved to: {json_path}")

    print("\n" + "=" * 80)
    print("✓ MINI-TEST COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    test_map_with_context()
