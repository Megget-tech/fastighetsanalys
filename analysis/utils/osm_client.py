"""
OpenStreetMap Client
Collects location data from OpenStreetMap via Nominatim and Overpass API.
"""
import time
import math
import requests
from typing import Dict, List, Tuple, Optional, Any


class OSMClient:
    """Client for OpenStreetMap data collection."""

    def __init__(self):
        self.nominatim_url = "https://nominatim.openstreetmap.org"
        self.overpass_url = "https://overpass-api.de/api/interpreter"
        self.user_agent = "RealEstateAnalysis/1.0"
        self.rate_limit_delay = 1.0  # Seconds between requests (be respectful)

    def geocode(self, location: str) -> Optional[Dict[str, Any]]:
        """
        Convert address to coordinates using Nominatim.

        Args:
            location: Address string (e.g., "Kvarnholmen, Nacka")

        Returns:
            Dict with name, coordinates, municipality, or None if not found
        """
        try:
            params = {
                "q": location,
                "format": "json",
                "limit": 1,
                "countrycodes": "se",  # Limit to Sweden
                "addressdetails": 1
            }

            headers = {"User-Agent": self.user_agent}

            response = requests.get(
                f"{self.nominatim_url}/search",
                params=params,
                headers=headers,
                timeout=10
            )
            response.raise_for_status()

            results = response.json()

            if not results:
                print(f"⚠️  Could not geocode location: {location}")
                return None

            result = results[0]

            # Extract municipality from address
            address = result.get("address", {})
            municipality = (
                address.get("municipality") or
                address.get("city") or
                address.get("town") or
                address.get("village") or
                "Unknown"
            )

            return {
                "name": result.get("display_name"),
                "coordinates": (float(result["lat"]), float(result["lon"])),
                "municipality": municipality,
                "address": address
            }

        except requests.RequestException as e:
            print(f"❌ Geocoding failed: {str(e)}")
            return None
        except (KeyError, ValueError) as e:
            print(f"❌ Invalid geocoding response: {str(e)}")
            return None

    def haversine_distance(self, coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
        """
        Calculate distance between two coordinates using Haversine formula.

        Args:
            coord1: (lat, lon) tuple
            coord2: (lat, lon) tuple

        Returns:
            Distance in meters
        """
        lat1, lon1 = coord1
        lat2, lon2 = coord2

        # Convert to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))

        # Earth radius in meters
        r = 6371000

        return r * c

    def query_pois(
        self,
        center: Tuple[float, float],
        radius_m: int,
        osm_query: str
    ) -> List[Dict[str, Any]]:
        """
        Query POI from Overpass API.

        Args:
            center: (lat, lon) tuple
            radius_m: Search radius in meters
            osm_query: OSM query filter (e.g., "amenity=school")

        Returns:
            List of POI dictionaries with name, coordinates, tags
        """
        try:
            lat, lon = center

            # Build Overpass query
            query = f"""
            [out:json][timeout:25];
            (
              node[{osm_query}](around:{radius_m},{lat},{lon});
              way[{osm_query}](around:{radius_m},{lat},{lon});
              relation[{osm_query}](around:{radius_m},{lat},{lon});
            );
            out center;
            """

            headers = {"User-Agent": self.user_agent}

            response = requests.post(
                self.overpass_url,
                data=query,
                headers=headers,
                timeout=30
            )
            response.raise_for_status()

            data = response.json()

            # Parse results
            pois = []
            for element in data.get("elements", []):
                # Get coordinates (handle nodes, ways, relations)
                if element["type"] == "node":
                    poi_lat, poi_lon = element["lat"], element["lon"]
                elif "center" in element:
                    poi_lat, poi_lon = element["center"]["lat"], element["center"]["lon"]
                else:
                    continue  # Skip if no coordinates

                poi_coords = (poi_lat, poi_lon)
                distance = self.haversine_distance(center, poi_coords)

                pois.append({
                    "name": element.get("tags", {}).get("name", "Unknown"),
                    "coordinates": poi_coords,
                    "distance_m": round(distance),
                    "tags": element.get("tags", {}),
                    "osm_type": element["type"],
                    "osm_id": element["id"]
                })

            # Sort by distance
            pois.sort(key=lambda x: x["distance_m"])

            # Rate limiting
            time.sleep(self.rate_limit_delay)

            return pois

        except requests.RequestException as e:
            print(f"⚠️  OSM query failed for '{osm_query}': {str(e)}")
            return []
        except (KeyError, ValueError) as e:
            print(f"⚠️  Invalid OSM response: {str(e)}")
            return []

    def get_infrastructure_data(
        self,
        center: Tuple[float, float],
        radius_m: int = 1000
    ) -> Dict[str, Any]:
        """
        Get comprehensive infrastructure data for an area.

        Args:
            center: (lat, lon) tuple
            radius_m: Search radius in meters

        Returns:
            Dictionary with categorized infrastructure data
        """
        print(f"📡 Querying OpenStreetMap (radius: {radius_m}m)...")

        # Query different categories
        categories = {
            "schools": "amenity=school",
            "kindergartens": "amenity=kindergarten",
            "healthcare": "amenity~\"^(doctors|clinic|hospital)$\"",
            "pharmacies": "amenity=pharmacy",
            "supermarkets": "shop=supermarket",
            "convenience_stores": "shop=convenience",
            "restaurants": "amenity=restaurant",
            "cafes": "amenity=cafe",
            "gyms": "leisure~\"^(fitness_centre|sports_centre)$\"",
            "parks": "leisure=park",
            "playgrounds": "leisure=playground",
            "bus_stops": "highway=bus_stop",
            "subway_stations": "railway=subway_entrance",
            "train_stations": "railway=station"
        }

        results = {}
        for category, query in categories.items():
            print(f"   Fetching {category}...")
            pois = self.query_pois(center, radius_m, query)
            results[category] = pois

        # Summarize results
        summary = self._summarize_infrastructure(results)

        return {
            "raw_data": results,
            "summary": summary
        }

    def _summarize_infrastructure(self, data: Dict[str, List[Dict]]) -> Dict[str, Any]:
        """Summarize infrastructure data into readable format."""
        summary = {}

        # Education
        summary["education"] = {
            "schools": len(data.get("schools", [])),
            "kindergartens": len(data.get("kindergartens", [])),
            "closest_school": data.get("schools", [None])[0] if data.get("schools") else None
        }

        # Retail
        summary["retail"] = {
            "supermarkets": len(data.get("supermarkets", [])),
            "convenience_stores": len(data.get("convenience_stores", [])),
            "closest_supermarket": data.get("supermarkets", [None])[0] if data.get("supermarkets") else None
        }

        # Healthcare
        summary["health"] = {
            "healthcare_centers": len(data.get("healthcare", [])),
            "pharmacies": len(data.get("pharmacies", [])),
            "closest_pharmacy": data.get("pharmacies", [None])[0] if data.get("pharmacies") else None
        }

        # Fitness & Recreation
        summary["fitness"] = {
            "gyms": len(data.get("gyms", [])),
            "sports_facilities": len(data.get("gyms", []))  # Combined
        }

        # Dining
        summary["dining"] = {
            "restaurants": len(data.get("restaurants", [])),
            "cafes": len(data.get("cafes", []))
        }

        # Recreation
        summary["recreation"] = {
            "parks": len(data.get("parks", [])),
            "playgrounds": len(data.get("playgrounds", []))
        }

        # Transit
        summary["transit"] = {
            "bus_stops": {
                "count": len(data.get("bus_stops", [])),
                "closest": data.get("bus_stops", [None])[0] if data.get("bus_stops") else None
            },
            "subway_stations": {
                "count": len(data.get("subway_stations", [])),
                "nearest": data.get("subway_stations", [None])[0] if data.get("subway_stations") else None
            },
            "train_stations": {
                "count": len(data.get("train_stations", [])),
                "nearest": data.get("train_stations", [None])[0] if data.get("train_stations") else None
            }
        }

        return summary
