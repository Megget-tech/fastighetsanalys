#!/usr/bin/env python3
"""
Test script for Lantmäteriet API
"""
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from utils.lantmateriet_client import LantmaterietClient


def test_lantmateriet():
    """Test Lantmäteriet API with various property designations."""

    client = LantmaterietClient()

    print("="*80)
    print("TESTING LANTMÄTERIET API")
    print("="*80)

    if not client.is_available():
        print("\n❌ Lantmäteriet API credentials not configured")
        print("   Make sure LANTMATERIET_API_KEY and LANTMATERIET_API_SECRET are set in .env")
        return 1

    print("\n✓ Lantmäteriet credentials configured")
    print(f"   API Key: {client.api_key[:10]}...")
    print(f"   API Secret: {client.api_secret[:10]}...")

    # Test cases
    test_cases = [
        "NACKA KVARNHOLMEN 1:1",
        "UMEÅ TOLVMANSGÅRDEN 4",
        "STOCKHOLM VASASTADEN 1:1",
    ]

    for property_designation in test_cases:
        print(f"\n{'='*80}")
        print(f"Testing: {property_designation}")
        print(f"{'='*80}")

        result = client.get_property_info(property_designation)

        if result:
            print("\n✓ SUCCESS - Property found!")
            print(f"\n📍 Property Information:")
            print(f"   Beteckning: {result.get('property_designation')}")
            print(f"   Coordinates: {result.get('coordinates')}")
            print(f"   Registerområde (Kommun): {result.get('registeromrade')}")
            print(f"   Trakt: {result.get('trakt')}")
            print(f"   Block: {result.get('block')}")
            print(f"   Enhet: {result.get('enhet')}")
            print(f"   Beteckningsstatus: {result.get('status')}")
            print(f"   Objektstatus: {result.get('objektstatus')}")
            print(f"   Typ: {result.get('typ')}")
            print(f"   Objektidentitet: {result.get('objektidentitet')[:40] if result.get('objektidentitet') else None}...")
        else:
            print("\n✗ FAILED - Property not found or API error")

    print(f"\n{'='*80}")
    print("TEST COMPLETE")
    print(f"{'='*80}\n")

    return 0


if __name__ == "__main__":
    sys.exit(test_lantmateriet())
