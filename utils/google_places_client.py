"""
Google Places Client
Collects commercial service data from Google Places API (optional).
"""
import os
import requests
from typing import Dict, List, Tuple, Optional, Any


class GooglePlacesClient:
    """Client for Google Places API (optional enhancement)."""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Google Places client.

        Args:
            api_key: Google Places API key. If None, will try to get from env.
        """
        self.api_key = api_key or os.getenv("GOOGLE_PLACES_API_KEY")
        self.base_url = "https://maps.googleapis.com/maps/api/place"

    def is_available(self) -> bool:
        """Check if Google Places API is available (has API key)."""
        return self.api_key is not None

    def nearby_search(
        self,
        center: Tuple[float, float],
        radius_m: int,
        place_type: str,
        keyword: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for nearby places of a specific type.

        Args:
            center: (lat, lon) tuple
            radius_m: Search radius in meters (max 50000)
            place_type: Google place type (e.g., "restaurant", "gym")
            keyword: Optional keyword to filter results

        Returns:
            List of places with details
        """
        if not self.is_available():
            return []

        try:
            lat, lon = center

            params = {
                "key": self.api_key,
                "location": f"{lat},{lon}",
                "radius": min(radius_m, 50000),  # Max 50km
                "type": place_type
            }

            if keyword:
                params["keyword"] = keyword

            response = requests.get(
                f"{self.base_url}/nearbysearch/json",
                params=params,
                timeout=10
            )
            response.raise_for_status()

            data = response.json()

            if data.get("status") != "OK":
                if data.get("status") == "ZERO_RESULTS":
                    return []
                print(f"⚠️  Google Places API returned status: {data.get('status')}")
                return []

            places = []
            for place in data.get("results", []):
                location = place.get("geometry", {}).get("location", {})
                lat = location.get("lat")
                lng = location.get("lng")  # Google uses "lng" not "lon"

                # Only add if we have valid coordinates
                if lat and lng:
                    places.append({
                        "name": place.get("name", "Unknown"),
                        "coordinates": [lat, lng],  # Use list format like OSM
                        "address": place.get("vicinity", ""),
                        "rating": place.get("rating"),
                        "user_ratings_total": place.get("user_ratings_total"),
                        "place_id": place.get("place_id"),
                        "types": place.get("types", []),
                        "distance_m": None  # Could calculate if needed
                    })

            return places

        except requests.RequestException as e:
            print(f"⚠️  Google Places query failed for '{place_type}': {str(e)}")
            return []
        except (KeyError, ValueError) as e:
            print(f"⚠️  Invalid Google Places response: {str(e)}")
            return []

    def get_commercial_data(
        self,
        center: Tuple[float, float],
        radius_m: int = 1000
    ) -> Dict[str, Any]:
        """
        Get comprehensive commercial service data.

        Args:
            center: (lat, lon) tuple
            radius_m: Search radius in meters

        Returns:
            Dictionary with categorized commercial data
        """
        if not self.is_available():
            print("⚠️  Google Places API key not available, using OSM data only")
            return {
                "available": False,
                "message": "Google Places API key not configured"
            }

        print(f"🔍 Querying Google Places for commercial data...")

        # Query different categories
        categories = {
            "restaurants": "restaurant",
            "cafes": "cafe",
            "gyms": "gym",
            "bars": "bar",
            "shopping": "shopping_mall",
            "beauty": "beauty_salon",
            "banks": "bank"
        }

        results = {}
        for category, place_type in categories.items():
            print(f"   Fetching {category}...")
            places = self.nearby_search(center, radius_m, place_type)
            results[category] = places

        # Summarize results
        summary = self._summarize_commercial(results)

        return {
            "available": True,
            "raw_data": results,
            "summary": summary
        }

    def _summarize_commercial(self, data: Dict[str, List[Dict]]) -> Dict[str, Any]:
        """Summarize commercial data into readable format."""
        summary = {}

        # Dining
        restaurants = data.get("restaurants", [])
        cafes = data.get("cafes", [])

        summary["dining"] = {
            "restaurants": len(restaurants),
            "cafes": len(cafes),
            "bars": len(data.get("bars", [])),
            "top_rated_restaurant": self._get_top_rated(restaurants),
            "top_rated_cafe": self._get_top_rated(cafes)
        }

        # Fitness
        gyms = data.get("gyms", [])
        summary["fitness"] = {
            "gyms": len(gyms),
            "top_rated_gym": self._get_top_rated(gyms)
        }

        # Shopping
        summary["shopping"] = {
            "shopping_malls": len(data.get("shopping", [])),
            "beauty_salons": len(data.get("beauty", []))
        }

        # Services
        summary["services"] = {
            "banks": len(data.get("banks", []))
        }

        return summary

    def _get_top_rated(self, places: List[Dict]) -> Optional[Dict[str, Any]]:
        """Get the highest rated place from a list."""
        if not places:
            return None

        # Filter places with ratings
        rated_places = [p for p in places if p.get("rating")]

        if not rated_places:
            return None

        # Sort by rating (and number of reviews as tiebreaker)
        sorted_places = sorted(
            rated_places,
            key=lambda x: (x.get("rating", 0), x.get("user_ratings_total", 0)),
            reverse=True
        )

        top = sorted_places[0]

        return {
            "name": top.get("name"),
            "rating": top.get("rating"),
            "reviews": top.get("user_ratings_total")
        }
