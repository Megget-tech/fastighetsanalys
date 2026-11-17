"""
Lantmäteriet Client
Retrieves property information and coordinates from Lantmäteriets API.
API: Registerbeteckning Direkt v5
Authentication: OAuth2 Client Credentials Grant
"""
import os
import requests
from typing import Dict, Optional, Any, Tuple
from datetime import datetime, timedelta


class LantmaterietClient:
    """Client for Lantmäteriets Registerbeteckning Direkt API v5."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None
    ):
        """
        Initialize Lantmäteriet client.

        Args:
            api_key: Lantmäteriet API key (client_id). If None, will try to get from env.
            api_secret: Lantmäteriet API secret (client_secret). If None, will try to get from env.
        """
        self.api_key = api_key or os.getenv("LANTMATERIET_API_KEY")
        self.api_secret = api_secret or os.getenv("LANTMATERIET_API_SECRET")
        self.base_url = "https://api.lantmateriet.se/distribution/produkter/registerbeteckning/v5"
        self.token_url = "https://apimanager.lantmateriet.se/oauth2/token"

        # Token cache
        self._access_token = None
        self._token_expires_at = None

    def is_available(self) -> bool:
        """Check if Lantmäteriet API is available (has both key and secret)."""
        return self.api_key is not None and self.api_secret is not None

    def _get_access_token(self) -> Optional[str]:
        """
        Get OAuth2 access token using client credentials grant.
        Uses cached token if still valid.

        Returns:
            Access token string, or None if failed
        """
        # Return cached token if still valid
        if self._access_token and self._token_expires_at:
            if datetime.now() < self._token_expires_at:
                return self._access_token

        try:
            # Request new token using client credentials grant
            data = {
                "grant_type": "client_credentials",
                "scope": "registerbeteckning_direkt_v5_read"
            }

            # Basic Auth with client_id:client_secret
            auth = (self.api_key, self.api_secret)

            response = requests.post(
                self.token_url,
                data=data,
                auth=auth,
                timeout=10
            )

            response.raise_for_status()

            token_data = response.json()

            # Extract access token and expiry
            self._access_token = token_data.get("access_token")
            expires_in = token_data.get("expires_in", 3600)  # Default 1 hour

            # Set expiry time with 60 second buffer
            self._token_expires_at = datetime.now() + timedelta(seconds=expires_in - 60)

            return self._access_token

        except requests.RequestException as e:
            print(f"⚠️  Failed to get access token: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"   Response: {e.response.text[:200]}")
            return None

    def get_property_info(self, property_designation: str) -> Optional[Dict[str, Any]]:
        """
        Get property information including coordinates from property designation.

        Args:
            property_designation: Fastighetsbeteckning (e.g., "UMEÅ TOLVMANSGÅRDEN 4")

        Returns:
            Dict with property info including coordinates, or None if not found
        """
        if not self.is_available():
            print("⚠️  Lantmäteriet API credentials not configured")
            return None

        try:
            # Get OAuth2 access token
            access_token = self._get_access_token()
            if not access_token:
                print("⚠️  Failed to obtain access token")
                return None

            # Normalize property designation (remove extra spaces, uppercase)
            normalized = " ".join(property_designation.strip().upper().split())

            # Use /namn endpoint to get property by name
            params = {
                "namn": normalized,
                "srid": "3006"  # SWEREF99 TM (Swedish standard)
            }

            # Use Bearer token authorization
            headers = {
                "Accept": "application/json",
                "Authorization": f"Bearer {access_token}"
            }

            response = requests.get(
                f"{self.base_url}/namn",
                params=params,
                headers=headers,
                timeout=10
            )

            response.raise_for_status()

            data = response.json()

            # API returns GeoJSON FeatureCollection
            if not data or not isinstance(data, dict):
                print(f"⚠️  No data returned for {normalized}")
                return None

            features = data.get("features", [])
            if not features:
                print(f"⚠️  No property found for {normalized}")
                return None

            # Get first feature
            feature = features[0]
            properties = feature.get("properties", {})
            geometry = feature.get("geometry")

            # Extract coordinates - they're in properties, not geometry
            coordinates = None

            # Try to get coordinates from registerenhetsreferens
            ref = properties.get("registerenhetsreferens", {})
            omraden = ref.get("registerenhetsomrade", [])

            if omraden and len(omraden) > 0:
                central_point = omraden[0].get("centralpunktskoordinat", {})
                coords = central_point.get("coordinates", [])

                if len(coords) >= 2:
                    # SWEREF99 TM coordinates [X (east), Y (north)]
                    x, y = coords[0], coords[1]
                    # Convert SWEREF99 TM to WGS84
                    lat, lon = self._sweref99_to_wgs84(x, y)
                    coordinates = (lat, lon)

            # Fallback: Try geometry field (if available)
            if not coordinates and geometry:
                geom_type = geometry.get("type")

                if geom_type == "Polygon":
                    coords_array = geometry.get("coordinates", [[[]]])
                    if coords_array and coords_array[0] and coords_array[0][0]:
                        x, y = coords_array[0][0][0], coords_array[0][0][1]
                        lat, lon = self._sweref99_to_wgs84(x, y)
                        coordinates = (lat, lon)

                elif geom_type == "Point":
                    coords = geometry.get("coordinates", [])
                    if len(coords) >= 2:
                        x, y = coords[0], coords[1]
                        lat, lon = self._sweref99_to_wgs84(x, y)
                        coordinates = (lat, lon)

            if not coordinates:
                print(f"⚠️  Could not extract coordinates for {normalized}")
                return None

            # Extract beteckning details from registerbeteckning array
            registerbeteckning_list = properties.get("registerbeteckning", [])
            beteckning_info = {}

            if registerbeteckning_list and len(registerbeteckning_list) > 0:
                # Get first (marked) beteckning
                beteckning = registerbeteckning_list[0]
                beteckning_info = {
                    "registeromrade": beteckning.get("registeromrade"),
                    "trakt": beteckning.get("trakt"),
                    "block": beteckning.get("block"),
                    "enhet": beteckning.get("enhet"),
                    "status": beteckning.get("beteckningsstatus"),
                    "objektidentitet": beteckning.get("objektidentitet")
                }

            # Extract registerenhets info
            ref = properties.get("registerenhetsreferens", {})

            # Build response
            return {
                "property_designation": normalized,
                "coordinates": coordinates,
                "registeromrade": beteckning_info.get("registeromrade"),  # This is typically "kommun"
                "trakt": beteckning_info.get("trakt"),
                "block": beteckning_info.get("block"),
                "enhet": beteckning_info.get("enhet"),
                "status": beteckning_info.get("status"),
                "objektidentitet": beteckning_info.get("objektidentitet"),
                "objektstatus": ref.get("objektstatus"),
                "typ": ref.get("typ"),
                "raw_data": feature
            }

        except requests.RequestException as e:
            print(f"⚠️  Lantmäteriet API request failed: {str(e)}")
            if hasattr(e.response, 'text'):
                print(f"   Response: {e.response.text[:200]}")
            return None
        except (KeyError, ValueError, IndexError) as e:
            print(f"⚠️  Failed to parse Lantmäteriet response: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    def _sweref99_to_wgs84(self, x: float, y: float) -> Tuple[float, float]:
        """
        Convert SWEREF99 TM coordinates to WGS84 (lat/lon).

        This is an approximation using pyproj if available,
        otherwise uses a simplified formula.

        Args:
            x: East coordinate (SWEREF99 TM)
            y: North coordinate (SWEREF99 TM)

        Returns:
            Tuple of (lat, lon) in WGS84
        """
        try:
            from pyproj import Transformer

            # Create transformer from SWEREF99 TM (EPSG:3006) to WGS84 (EPSG:4326)
            transformer = Transformer.from_crs("EPSG:3006", "EPSG:4326", always_xy=True)

            # Transform returns (lon, lat) when always_xy=True
            lon, lat = transformer.transform(x, y)

            return (lat, lon)

        except ImportError:
            # Fallback: Very rough approximation for Sweden
            # This is not accurate and should only be used as last resort
            print("⚠️  pyproj not installed, using rough approximation for coordinate conversion")

            # Rough conversion (VERY APPROXIMATE - only for central Sweden)
            # SWEREF99 TM origin is roughly at lat 0°, lon 15°E
            lat = 58.0 + (y - 6500000) / 111320.0
            lon = 15.0 + (x - 500000) / 74800.0

            return (lat, lon)


def parse_property_designation(property_designation: str) -> Tuple[str, str, str]:
    """
    Parse property designation into kommun, trakt, enhet.

    Args:
        property_designation: "UMEÅ TOLVMANSGÅRDEN 4"

    Returns:
        (kommun, trakt, enhet) tuple
    """
    parts = property_designation.strip().upper().split()

    if len(parts) >= 2:
        kommun = parts[0]
        trakt = parts[1] if len(parts) > 1 else ""
        enhet = parts[2] if len(parts) > 2 else ""
        return kommun, trakt, enhet
    elif len(parts) == 1:
        return parts[0], "", ""
    else:
        return "", "", ""


def property_designation_to_location(property_designation: str) -> str:
    """
    Convert property designation to searchable location string.

    Args:
        property_designation: "UMEÅ TOLVMANSGÅRDEN 4"

    Returns:
        Location string suitable for geocoding (e.g., "Tolvmansgården, Umeå")
    """
    kommun, trakt, enhet = parse_property_designation(property_designation)

    # Try trakt + kommun first (most specific)
    if trakt and kommun:
        # Capitalize first letter, lowercase rest for trakt
        trakt_formatted = trakt.capitalize()
        kommun_formatted = kommun.capitalize()
        return f"{trakt_formatted}, {kommun_formatted}"

    # Fallback to just kommun
    if kommun:
        return kommun.capitalize()

    # Last resort: return original
    return property_designation
