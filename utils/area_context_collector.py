"""
Area Context Collector
Main component that combines OSM, Trafiklab, and Google Places data
to create comprehensive area context for real estate analysis.
"""
import json
from typing import Dict, List, Tuple, Optional, Any
from .osm_client import OSMClient
from .trafiklab_client import TrafiklabClient
from .google_places_client import GooglePlacesClient
from .google_distance_matrix import GoogleDistanceMatrixClient
from .lantmateriet_client import (
    LantmaterietClient,
    property_designation_to_location
)


class AreaContextCollector:
    """
    Collects comprehensive area context data from multiple sources.

    Combines data from:
    - OpenStreetMap: Infrastructure, public services, nature
    - Trafiklab: Public transit frequency and travel times
    - Google Places (optional): Commercial services with ratings
    """

    def __init__(
        self,
        google_api_key: Optional[str] = None,
        trafiklab_api_key: Optional[str] = None,
        lantmateriet_api_key: Optional[str] = None,
        lantmateriet_api_secret: Optional[str] = None
    ):
        """
        Initialize Area Context Collector.

        Args:
            google_api_key: Optional Google Places API key
            trafiklab_api_key: Optional Trafiklab API key
            lantmateriet_api_key: Optional Lantmäteriet API key (username)
            lantmateriet_api_secret: Optional Lantmäteriet API secret (password)
        """
        self.osm = OSMClient()
        self.trafiklab = TrafiklabClient(trafiklab_api_key)
        self.google = GooglePlacesClient(google_api_key) if google_api_key or GooglePlacesClient().is_available() else None
        self.google_distance = GoogleDistanceMatrixClient(google_api_key)
        self.lantmateriet = LantmaterietClient(lantmateriet_api_key, lantmateriet_api_secret)

        print("🏗️  Area Context Collector initialized")
        print(f"   OSM: ✅ Available")
        print(f"   Lantmäteriet: {'✅ Available' if self.lantmateriet.is_available() else '⚠️  Not configured (will use fallback)'}")
        print(f"   Trafiklab: {'✅ Available' if self.trafiklab.is_available() else '⚠️  Not configured (optional)'}")
        print(f"   Google Places: {'✅ Available' if self.google and self.google.is_available() else '⚠️  Not configured (optional)'}")
        print(f"   Google Distance Matrix: {'✅ Available' if self.google_distance.is_available() else '⚠️  Not configured (optional)'}")

    def collect(
        self,
        location: Optional[str] = None,
        property_designation: Optional[str] = None,
        radius_m: int = 1000,
        destinations: Optional[List[str]] = None,
        future_plans: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Collect comprehensive area context data.

        Args:
            location: Location name or address (e.g., "Kvarnholmen, Nacka")
            property_designation: Property designation (e.g., "UMEÅ TOLVMANSGÅRDEN 4")
                                 Takes priority over location if both provided
            radius_m: Search radius in meters (default 1000m = 1km)
            destinations: Optional list of destinations for travel time calculations
            future_plans: Optional list of future development plans/visions

        Returns:
            Complete area context dictionary
        """
        # Determine what to search for
        search_term = property_designation or location
        if not search_term:
            return {
                "error": "Either location or property_designation must be provided"
            }

        print(f"\n{'='*80}")
        print(f"COLLECTING AREA CONTEXT: {search_term}")
        print(f"{'='*80}\n")

        # Default destinations if not provided
        if destinations is None:
            destinations = [
                "Stockholm Centralen",
                "Slussen",
                "T-Centralen"
            ]

        # Step 1: Resolve location to coordinates
        print("📍 Step 1/4: Resolving location to coordinates...")

        location_data = None
        property_info = None

        # Try Lantmäteriet first if property designation provided
        if property_designation and self.lantmateriet.is_available():
            print("   Trying Lantmäteriet API...")
            property_info = self.lantmateriet.get_property_info(property_designation)

            if property_info:
                coords = property_info["coordinates"]
                # registeromrade is the kommun (municipality)
                kommun = property_info.get("registeromrade", "Unknown")
                trakt = property_info.get("trakt", "")

                # Build display name
                if trakt and kommun:
                    display_name = f"{trakt}, {kommun}"
                elif kommun:
                    display_name = kommun
                else:
                    display_name = property_designation

                location_data = {
                    "name": display_name,
                    "coordinates": coords,
                    "municipality": kommun,
                    "property_designation": property_designation,
                    "source": "lantmateriet"
                }
                print(f"   ✓ Found via Lantmäteriet: {location_data['name']}")

        # Fallback: Use OSM geocoding
        if not location_data:
            # Convert property designation to location string if needed
            if property_designation:
                print("   Fallback: Converting property designation to location...")
                location = property_designation_to_location(property_designation)
                print(f"   Converted to: {location}")

            print("   Geocoding with OpenStreetMap...")
            location_data = self.osm.geocode(location)

            if not location_data:
                return {
                    "error": "Could not geocode location",
                    "location": search_term
                }

            location_data["source"] = "osm"
            if property_designation:
                location_data["property_designation"] = property_designation

        coords = location_data["coordinates"]
        print(f"   ✓ Found: {location_data['name']}")
        print(f"   ✓ Coordinates: {coords}")
        print(f"   ✓ Municipality: {location_data['municipality']}")
        print(f"   ✓ Source: {location_data.get('source', 'unknown')}")

        # Step 2: Collect infrastructure data from OSM
        print(f"\n📍 Step 2/4: Collecting infrastructure data from OpenStreetMap...")
        osm_data = self.osm.get_infrastructure_data(coords, radius_m)
        print(f"   ✓ Infrastructure data collected")

        # Step 3: Collect transit data from Trafiklab (stops + frequency)
        print(f"\n🚌 Step 3/5: Collecting transit stops from Trafiklab...")
        # Don't pass destinations to Trafiklab anymore - we'll use Google for travel times
        transit_data = self.trafiklab.get_transit_analysis(coords, radius_m, destinations=None)
        print(f"   ✓ Transit stops collected")

        # Step 4: Get travel times from Google Distance Matrix
        travel_times = {}
        if destinations and self.google_distance.is_available():
            print(f"\n🗺️  Step 4/5: Calculating travel times with Google Distance Matrix...")
            # Get municipality for default destination
            municipality = location_data.get("municipality", "")
            # Determine destinations based on municipality or use provided list
            if not destinations or len(destinations) == 0:
                # Default: just "{city} centrum"
                if municipality:
                    destinations = [f"{municipality} centrum"]

            travel_times = self.google_distance.get_multiple_transit_times(coords, destinations)
            if travel_times:
                num_successful = sum(1 for v in travel_times.values() if v is not None)
                print(f"   ✓ Travel times calculated ({num_successful}/{len(destinations)} destinations)")
            else:
                print(f"   ⚠️  No travel times available")
        else:
            print(f"\n⏭️  Step 4/5: Skipping travel times (Google Distance Matrix not configured)")

        # Step 5: Optionally collect commercial data from Google Places
        google_data = None
        if self.google and self.google.is_available():
            print(f"\n🔍 Step 5/5: Collecting commercial data from Google Places...")
            google_data = self.google.get_commercial_data(coords, radius_m)
            print(f"   ✓ Commercial data collected")
        else:
            print(f"\n⏭️  Step 5/5: Skipping Google Places (not configured)")

        # Combine all data
        print(f"\n🔄 Combining data from all sources...")
        area_context = self._synthesize_area_context(
            location_data,
            osm_data,
            transit_data,
            travel_times,
            google_data,
            future_plans
        )

        print(f"\n{'='*80}")
        print(f"✓ AREA CONTEXT COLLECTION COMPLETE")
        print(f"{'='*80}\n")

        return area_context

    def _synthesize_area_context(
        self,
        location_data: Dict,
        osm_data: Dict,
        transit_data: Dict,
        travel_times: Dict,
        google_data: Optional[Dict],
        future_plans: Optional[List[str]]
    ) -> Dict[str, Any]:
        """
        Synthesize data from all sources into final area context structure.

        Args:
            location_data: Geocoded location data
            osm_data: OpenStreetMap infrastructure data
            transit_data: Trafiklab transit data
            google_data: Google Places commercial data (optional)
            future_plans: User-provided future plans (optional)

        Returns:
            Complete area context dictionary
        """
        osm_summary = osm_data.get("summary", {})
        transit_summary = transit_data.get("summary", {})

        # Merge OSM and Google data for services
        services = {
            "education": osm_summary.get("education", {}),
            "retail": osm_summary.get("retail", {}),
            "health": osm_summary.get("health", {}),
            "fitness": self._merge_fitness_data(
                osm_summary.get("fitness", {}),
                google_data.get("summary", {}).get("fitness", {}) if google_data else {}
            ),
            "dining": self._merge_dining_data(
                osm_summary.get("dining", {}),
                google_data.get("summary", {}).get("dining", {}) if google_data else {}
            ),
            "recreation": osm_summary.get("recreation", {})
        }

        # Merge raw infrastructure data from OSM and Google Places
        raw_infrastructure = self._merge_raw_infrastructure(
            osm_data.get("raw_data", {}),
            google_data
        )

        # Build area context
        area_context = {
            "location": {
                "name": location_data["name"],
                "coordinates": location_data["coordinates"],
                "municipality": location_data["municipality"]
            },
            "services_within_1km": services,
            "transit_access": self._build_transit_access(transit_data, travel_times),
            "recreation": osm_summary.get("recreation", {}),
            "raw_infrastructure": raw_infrastructure,  # Merged OSM + Google Places POI data for maps
            "data_sources": {
                "osm": True,
                "trafiklab": transit_data.get("available", False),
                "google_places": google_data is not None and google_data.get("available", False),
                "google_distance_matrix": len(travel_times) > 0
            }
        }

        # Add future plans if provided
        if future_plans:
            area_context["future_plans"] = future_plans

        # Add quality summary
        area_context["summary"] = self._generate_summary(area_context)

        return area_context

    def _merge_fitness_data(self, osm_data: Dict, google_data: Dict) -> Dict:
        """Merge fitness data from OSM and Google."""
        if google_data and google_data.get("gyms"):
            return {
                "gyms": google_data.get("gyms", 0),
                "top_rated_gym": google_data.get("top_rated_gym"),
                "source": "google_places"
            }
        return osm_data

    def _merge_dining_data(self, osm_data: Dict, google_data: Dict) -> Dict:
        """Merge dining data from OSM and Google."""
        if google_data:
            return {
                "restaurants": google_data.get("restaurants", osm_data.get("restaurants", 0)),
                "cafes": google_data.get("cafes", osm_data.get("cafes", 0)),
                "bars": google_data.get("bars", 0),
                "top_rated_restaurant": google_data.get("top_rated_restaurant"),
                "top_rated_cafe": google_data.get("top_rated_cafe"),
                "source": "google_places"
            }
        return osm_data

    def _merge_raw_infrastructure(self, osm_raw: Dict, google_data: Optional[Dict]) -> Dict:
        """
        Merge raw POI data from OSM and Google Places for map generation.

        If OSM data is empty/incomplete (due to timeouts), use Google Places data.
        """
        merged = dict(osm_raw)  # Start with OSM data

        if not google_data or not google_data.get("available"):
            return merged

        # Get Google Places raw data
        google_raw = google_data.get("raw_data", {})

        # If OSM has no restaurants, use Google's
        if len(merged.get("restaurants", [])) == 0 and "restaurants" in google_raw:
            merged["restaurants"] = google_raw.get("restaurants", [])

        # If OSM has no cafes, use Google's
        if len(merged.get("cafes", [])) == 0 and "cafes" in google_raw:
            merged["cafes"] = google_raw.get("cafes", [])

        # If OSM has no gyms, use Google's
        if len(merged.get("gyms", [])) == 0 and "gyms" in google_raw:
            merged["gyms"] = google_raw.get("gyms", [])

        return merged

    def _build_transit_access(self, transit_data: Dict, travel_times: Dict) -> Dict:
        """Build transit access summary from Trafiklab data and Google Distance Matrix."""
        if not transit_data.get("available"):
            # Fallback to basic transit info
            return {
                "available": False,
                "message": "Transit data not available"
            }

        closest_stop = transit_data.get("closest_stop", {})
        frequency_analysis = transit_data.get("frequency_analysis", {})

        # Build frequency summary
        freq_summary = {}
        if frequency_analysis:
            # Use the first stop's frequency data
            first_stop_freq = list(frequency_analysis.values())[0] if frequency_analysis else {}
            freq_summary = {
                "description": first_stop_freq.get("description", "Data unavailable"),
                "average_frequency_min": first_stop_freq.get("average_frequency_min", 0),
                "total_departures_weekday": first_stop_freq.get("total_departures", 0)
            }

        return {
            "available": True,
            "closest_stop": {
                "name": closest_stop.get("name", "Unknown"),
                "distance_m": closest_stop.get("distance_m", 0),
                "lines": frequency_analysis.get(closest_stop.get("name", ""), {}).get("lines", [])
            } if closest_stop else None,
            "frequency_analysis": freq_summary,
            "travel_times": {
                name: {
                    "destination": data.get("destination"),
                    "duration_min": data.get("duration_min"),
                    "duration_text": data.get("duration_text"),
                    "distance_m": data.get("distance_m"),
                    "distance_text": data.get("distance_text"),
                    "transit_details": data.get("transit_details"),
                    "departure_time": data.get("departure_time")
                }
                for name, data in travel_times.items() if data is not None
            },
            "nearby_stops": transit_data.get("nearby_stops", []),  # Include full list for map generation
            "nearby_stops_count": len(transit_data.get("nearby_stops", []))
        }

    def _generate_summary(self, area_context: Dict) -> str:
        """Generate a human-readable summary of the area."""
        location = area_context["location"]["name"]
        services = area_context.get("services_within_1km", {})
        transit = area_context.get("transit_access", {})

        # Count services
        schools = services.get("education", {}).get("schools", 0)
        supermarkets = services.get("retail", {}).get("supermarkets", 0)
        restaurants = services.get("dining", {}).get("restaurants", 0)
        cafes = services.get("dining", {}).get("cafes", 0)
        gyms = services.get("fitness", {}).get("gyms", 0)

        # Transit quality
        transit_quality = "ej tillgänglig"
        if transit.get("available"):
            closest = transit.get("closest_stop", {})
            if closest:
                dist = closest.get("distance_m", 999999)
                if dist < 300:
                    transit_quality = "utmärkt"
                elif dist < 500:
                    transit_quality = "god"
                else:
                    transit_quality = "godtagbar"

        summary = f"{location} har {schools} skolor, {supermarkets} mataffär(er), " \
                  f"{restaurants} restauranger och {cafes} caféer inom 1 km. " \
                  f"Kollektivtrafik: {transit_quality}."

        return summary
