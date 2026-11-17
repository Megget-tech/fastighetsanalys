"""
Map Generator
Generates static maps with POI markers using Google Static Maps API.
"""
import os
import requests
from typing import Dict, List, Tuple, Optional
from urllib.parse import urlencode


class MapGenerator:
    """Generates static maps with property and POI markers."""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize map generator.

        Args:
            api_key: Google Maps API key. If None, will try to get from env.
        """
        self.api_key = api_key or os.getenv("GOOGLE_PLACES_API_KEY")
        self.base_url = "https://maps.googleapis.com/maps/api/staticmap"

    def is_available(self) -> bool:
        """Check if Google Maps API is available."""
        return self.api_key is not None

    def generate_area_map(
        self,
        center_coords: Tuple[float, float],
        area_context: Dict,
        output_path: str,
        width: int = 800,
        height: int = 600,
        zoom: int = 14
    ) -> Optional[str]:
        """
        Generate a static map showing property and nearby POIs.

        Args:
            center_coords: (lat, lon) tuple for property location
            area_context: Area context data with POI information
            output_path: Path to save the map image
            width: Map width in pixels (max 640 for free tier)
            height: Map height in pixels (max 640 for free tier)
            zoom: Zoom level (1-20, where 14 is neighborhood level)

        Returns:
            Path to saved map image, or None if failed
        """
        if not self.is_available():
            print("⚠️  Google Maps API key not configured")
            return None

        # Ensure dimensions are within limits
        width = min(width, 640)
        height = min(height, 640)

        lat, lon = center_coords

        # Build markers list
        markers = []

        # 1. Property marker (red, large)
        markers.append({
            "color": "red",
            "label": "P",
            "size": "mid",
            "coords": [(lat, lon)]
        })

        # 2. Transit stops (blue)
        transit_markers = self._extract_transit_markers(area_context)
        if transit_markers:
            print(f"   • {len(transit_markers)} transit stops found, adding {min(len(transit_markers), 10)} to map")
            markers.append({
                "color": "blue",
                "label": "B",
                "size": "small",
                "coords": transit_markers[:10]  # Limit to 10 closest
            })

        # 3. Schools (green)
        school_markers = self._extract_school_markers(area_context)
        if school_markers:
            print(f"   • {len(school_markers)} schools found, adding {min(len(school_markers), 5)} to map")
            markers.append({
                "color": "green",
                "label": "S",
                "size": "small",
                "coords": school_markers[:5]  # Limit to 5 closest
            })

        # 4. Supermarkets (orange)
        supermarket_markers = self._extract_supermarket_markers(area_context)
        if supermarket_markers:
            print(f"   • {len(supermarket_markers)} supermarkets found, adding {min(len(supermarket_markers), 3)} to map")
            markers.append({
                "color": "orange",
                "label": "M",
                "size": "small",
                "coords": supermarket_markers[:3]  # Limit to 3 closest
            })

        # 5. Restaurants (red with R label)
        restaurant_markers = self._extract_restaurant_markers(area_context)
        if restaurant_markers:
            print(f"   • {len(restaurant_markers)} restaurants/cafes found, adding {min(len(restaurant_markers), 5)} to map")
            markers.append({
                "color": "red",
                "label": "R",
                "size": "small",
                "coords": restaurant_markers[:5]  # Limit to 5 closest
            })

        # 6. Gyms (purple)
        gym_markers = self._extract_gym_markers(area_context)
        if gym_markers:
            print(f"   • {len(gym_markers)} gyms found, adding {min(len(gym_markers), 3)} to map")
            markers.append({
                "color": "purple",
                "label": "G",
                "size": "small",
                "coords": gym_markers[:3]  # Limit to 3 closest
            })

        # Build URL
        url = self._build_map_url(
            center=(lat, lon),
            zoom=zoom,
            size=(width, height),
            markers=markers
        )

        # Download map
        try:
            print(f"📍 Generating map for {lat:.4f}, {lon:.4f}...")
            response = requests.get(url, timeout=30)
            response.raise_for_status()

            # Ensure output directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            # Save image
            with open(output_path, 'wb') as f:
                f.write(response.content)

            print(f"   ✓ Map saved to: {output_path}")
            return output_path

        except requests.RequestException as e:
            print(f"⚠️  Failed to generate map: {str(e)}")
            return None

    def _build_map_url(
        self,
        center: Tuple[float, float],
        zoom: int,
        size: Tuple[int, int],
        markers: List[Dict]
    ) -> str:
        """
        Build Google Static Maps API URL.

        Args:
            center: (lat, lon) center coordinates
            zoom: Zoom level
            size: (width, height) in pixels
            markers: List of marker definitions

        Returns:
            Complete API URL
        """
        lat, lon = center
        width, height = size

        # Base parameters
        params = {
            "center": f"{lat},{lon}",
            "zoom": zoom,
            "size": f"{width}x{height}",
            "maptype": "roadmap",
            "key": self.api_key
        }

        # Build URL with base params
        url_parts = [f"{self.base_url}?{urlencode(params)}"]

        # Add markers (can't use urlencode for multiple markers)
        for marker_group in markers:
            color = marker_group.get("color", "red")
            label = marker_group.get("label", "")
            size = marker_group.get("size", "mid")
            coords = marker_group.get("coords", [])

            if not coords:
                continue

            # Format: markers=color:red|label:A|size:mid|lat1,lon1|lat2,lon2
            marker_params = [f"color:{color}"]
            if label:
                marker_params.append(f"label:{label}")
            marker_params.append(f"size:{size}")

            # Add coordinates
            coord_strings = [f"{lat},{lon}" for lat, lon in coords]
            marker_params.extend(coord_strings)

            marker_string = "|".join(marker_params)
            url_parts.append(f"&markers={marker_string}")

        return "".join(url_parts)

    def _extract_transit_markers(self, area_context: Dict) -> List[Tuple[float, float]]:
        """Extract transit stop coordinates from area context."""
        markers = []

        try:
            # Get from raw OSM infrastructure data
            raw_infrastructure = area_context.get("raw_infrastructure", {})
            bus_stops = raw_infrastructure.get("bus_stops", [])

            for stop in bus_stops:
                coords = stop.get("coordinates")
                if coords and len(coords) == 2:
                    markers.append((coords[0], coords[1]))

            # Get from Trafiklab data
            transit_access = area_context.get("transit_access", {})
            nearby_stops = transit_access.get("nearby_stops", [])

            for stop in nearby_stops:
                coords = stop.get("coordinates")
                if coords and len(coords) == 2:
                    markers.append((coords[0], coords[1]))

        except (KeyError, TypeError, AttributeError):
            pass

        return markers

    def _extract_school_markers(self, area_context: Dict) -> List[Tuple[float, float]]:
        """Extract school coordinates from area context."""
        markers = []

        try:
            raw_infrastructure = area_context.get("raw_infrastructure", {})
            schools = raw_infrastructure.get("schools", [])

            for school in schools:
                coords = school.get("coordinates")
                if coords and len(coords) == 2:
                    markers.append((coords[0], coords[1]))

        except (KeyError, TypeError, AttributeError):
            pass

        return markers

    def _extract_supermarket_markers(self, area_context: Dict) -> List[Tuple[float, float]]:
        """Extract supermarket coordinates from area context."""
        markers = []

        try:
            raw_infrastructure = area_context.get("raw_infrastructure", {})
            supermarkets = raw_infrastructure.get("supermarkets", [])

            for market in supermarkets:
                coords = market.get("coordinates")
                if coords and len(coords) == 2:
                    markers.append((coords[0], coords[1]))

        except (KeyError, TypeError, AttributeError):
            pass

        return markers

    def _extract_restaurant_markers(self, area_context: Dict) -> List[Tuple[float, float]]:
        """Extract restaurant coordinates from area context."""
        markers = []

        try:
            raw_infrastructure = area_context.get("raw_infrastructure", {})
            restaurants = raw_infrastructure.get("restaurants", [])

            for restaurant in restaurants:
                coords = restaurant.get("coordinates")
                if coords and len(coords) == 2:
                    markers.append((coords[0], coords[1]))

            # Also add cafes
            cafes = raw_infrastructure.get("cafes", [])
            for cafe in cafes:
                coords = cafe.get("coordinates")
                if coords and len(coords) == 2:
                    markers.append((coords[0], coords[1]))

        except (KeyError, TypeError, AttributeError):
            pass

        return markers

    def _extract_gym_markers(self, area_context: Dict) -> List[Tuple[float, float]]:
        """Extract gym coordinates from area context."""
        markers = []

        try:
            raw_infrastructure = area_context.get("raw_infrastructure", {})
            gyms = raw_infrastructure.get("gyms", [])

            for gym in gyms:
                coords = gym.get("coordinates")
                if coords and len(coords) == 2:
                    markers.append((coords[0], coords[1]))

        except (KeyError, TypeError, AttributeError):
            pass

        return markers
