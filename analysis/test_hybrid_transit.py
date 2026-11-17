"""
Test script for hybrid transit data collection (Trafiklab + Google Distance Matrix)
"""
import os
import json
from utils.area_context_collector import AreaContextCollector

def test_hybrid_transit():
    """Test the hybrid transit approach"""

    print("Testing Hybrid Transit Data Collection")
    print("=" * 80)

    # Initialize collector
    collector = AreaContextCollector(
        google_api_key=os.getenv("GOOGLE_PLACES_API_KEY"),
        trafiklab_api_key=os.getenv("TRAFIKLAB_API_KEY"),
        lantmateriet_api_key=os.getenv("LANTMATERIET_API_KEY"),
        lantmateriet_api_secret=os.getenv("LANTMATERIET_API_SECRET")
    )

    # Test with Umeå
    print("\n\nTEST 1: Umeå Tolvmansgården 4")
    print("-" * 80)

    result = collector.collect(
        property_designation="UMEÅ TOLVMANSGÅRDEN 4",
        radius_m=1000,
        destinations=["Umeå centrum", "Universitetet Umeå"]
    )

    # Display transit access info
    if "transit_access" in result:
        transit = result["transit_access"]
        print("\n📍 TRANSIT ACCESS:")
        print(json.dumps(transit, indent=2, ensure_ascii=False))

    # Display data sources
    if "data_sources" in result:
        print("\n📊 DATA SOURCES:")
        print(json.dumps(result["data_sources"], indent=2, ensure_ascii=False))

    print("\n" + "=" * 80)
    print("✓ Test completed successfully!")

    return result

if __name__ == "__main__":
    result = test_hybrid_transit()
