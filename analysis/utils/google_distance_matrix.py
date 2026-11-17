"""
Google Maps Distance Matrix Client
Calculates travel times and distances using Google Maps Distance Matrix API.
Supports multiple transportation modes including public transit.
"""
import os
import requests
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime


class GoogleDistanceMatrixClient:
    """Client for Google Maps Distance Matrix API."""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Google Distance Matrix client.

        Args:
            api_key: Google Maps API key. If None, will try to get from env.
        """
        self.api_key = api_key or os.getenv("GOOGLE_PLACES_API_KEY")
        self.base_url = "https://maps.googleapis.com/maps/api/distancematrix/json"

    def is_available(self) -> bool:
        """Check if Google Maps API is available."""
        return self.api_key is not None

    def get_transit_time(
        self,
        origin: Tuple[float, float],
        destination: str,
        departure_time: Optional[datetime] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get public transit travel time from origin to destination.

        Args:
            origin: (lat, lon) tuple for starting point
            destination: Destination as address string (e.g., "Stockholm centrum", "T-Centralen")
            departure_time: Optional departure time (defaults to now)

        Returns:
            Dict with duration, distance, and route details, or None if failed
        """
        if not self.is_available():
            print("⚠️  Google Maps API key not configured")
            return None

        try:
            lat, lon = origin

            # Use current time if not specified
            if not departure_time:
                departure_time = datetime.now()

            # Convert to Unix timestamp
            departure_timestamp = int(departure_time.timestamp())

            params = {
                "origins": f"{lat},{lon}",
                "destinations": destination,
                "mode": "transit",  # Public transportation
                "departure_time": departure_timestamp,
                "key": self.api_key,
                "language": "sv"  # Swedish language for results
            }

            response = requests.get(self.base_url, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()

            # Check status
            if data.get("status") != "OK":
                print(f"⚠️  Google Maps API error: {data.get('status')}")
                if "error_message" in data:
                    print(f"   {data['error_message']}")
                return None

            # Get first row (we only sent one origin)
            rows = data.get("rows", [])
            if not rows:
                return None

            # Get first element (we only sent one destination)
            elements = rows[0].get("elements", [])
            if not elements:
                return None

            element = elements[0]

            # Check element status
            if element.get("status") != "OK":
                print(f"⚠️  No route found: {element.get('status')}")
                return None

            # Extract duration and distance
            duration_data = element.get("duration", {})
            distance_data = element.get("distance", {})

            duration_seconds = duration_data.get("value", 0)
            duration_text = duration_data.get("text", "")
            distance_meters = distance_data.get("value", 0)
            distance_text = distance_data.get("text", "")

            # Extract transit details if available
            transit_details = None
            if "transit_details" in element:
                transit_details = self._parse_transit_details(element["transit_details"])

            return {
                "destination": destination,
                "duration_min": duration_seconds // 60,
                "duration_text": duration_text,
                "distance_m": distance_meters,
                "distance_text": distance_text,
                "transit_details": transit_details,
                "departure_time": departure_time.strftime("%H:%M")
            }

        except requests.RequestException as e:
            print(f"⚠️  Google Maps Distance Matrix request failed: {str(e)}")
            return None
        except (KeyError, ValueError) as e:
            print(f"⚠️  Invalid Google Maps response: {str(e)}")
            return None

    def get_multiple_transit_times(
        self,
        origin: Tuple[float, float],
        destinations: List[str],
        departure_time: Optional[datetime] = None
    ) -> Dict[str, Optional[Dict[str, Any]]]:
        """
        Get transit times to multiple destinations in one API call.

        Args:
            origin: (lat, lon) tuple for starting point
            destinations: List of destination strings
            departure_time: Optional departure time (defaults to now)

        Returns:
            Dict mapping destination names to travel time data
        """
        if not self.is_available():
            return {}

        if not destinations:
            return {}

        try:
            lat, lon = origin

            # Use current time if not specified
            if not departure_time:
                departure_time = datetime.now()

            departure_timestamp = int(departure_time.timestamp())

            # Join destinations with pipe separator
            destinations_str = "|".join(destinations)

            params = {
                "origins": f"{lat},{lon}",
                "destinations": destinations_str,
                "mode": "transit",
                "departure_time": departure_timestamp,
                "key": self.api_key,
                "language": "sv"
            }

            response = requests.get(self.base_url, params=params, timeout=15)
            response.raise_for_status()

            data = response.json()

            if data.get("status") != "OK":
                print(f"⚠️  Google Maps API error: {data.get('status')}")
                return {}

            # Parse results for each destination
            results = {}
            rows = data.get("rows", [])

            if not rows:
                return {}

            elements = rows[0].get("elements", [])

            for i, destination in enumerate(destinations):
                if i >= len(elements):
                    results[destination] = None
                    continue

                element = elements[i]

                if element.get("status") != "OK":
                    results[destination] = None
                    continue

                duration_data = element.get("duration", {})
                distance_data = element.get("distance", {})

                duration_seconds = duration_data.get("value", 0)
                duration_text = duration_data.get("text", "")
                distance_meters = distance_data.get("value", 0)
                distance_text = distance_data.get("text", "")

                # Extract transit details if available
                transit_details = None
                if "transit_details" in element:
                    transit_details = self._parse_transit_details(element["transit_details"])

                results[destination] = {
                    "destination": destination,
                    "duration_min": duration_seconds // 60,
                    "duration_text": duration_text,
                    "distance_m": distance_meters,
                    "distance_text": distance_text,
                    "transit_details": transit_details,
                    "departure_time": departure_time.strftime("%H:%M")
                }

            return results

        except requests.RequestException as e:
            print(f"⚠️  Google Maps Distance Matrix request failed: {str(e)}")
            return {}
        except (KeyError, ValueError) as e:
            print(f"⚠️  Invalid Google Maps response: {str(e)}")
            return {}

    def _parse_transit_details(self, transit_data: Dict) -> Optional[Dict[str, Any]]:
        """
        Parse transit details from Google Maps response.

        Args:
            transit_data: Transit details from API response

        Returns:
            Simplified transit details dict
        """
        try:
            # Extract arrival/departure stops
            arrival_stop = transit_data.get("arrival_stop", {}).get("name", "")
            departure_stop = transit_data.get("departure_stop", {}).get("name", "")

            # Extract line information
            line_data = transit_data.get("line", {})
            line_name = line_data.get("short_name", line_data.get("name", ""))
            vehicle_type = line_data.get("vehicle", {}).get("type", "")

            # Number of stops
            num_stops = transit_data.get("num_stops", 0)

            return {
                "line": line_name,
                "vehicle_type": vehicle_type,
                "departure_stop": departure_stop,
                "arrival_stop": arrival_stop,
                "num_stops": num_stops
            }

        except (KeyError, AttributeError):
            return None
