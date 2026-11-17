"""
Trafiklab Client
Collects public transit data from Trafiklab APIs (ResRobot).
"""
import os
import requests
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime, timedelta


class TrafiklabClient:
    """Client for Trafiklab public transit data."""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Trafiklab client.

        Args:
            api_key: Trafiklab API key (for ResRobot). If None, will try to get from env.
        """
        self.api_key = api_key or os.getenv("TRAFIKLAB_API_KEY")
        self.resrobot_base_url = "https://api.resrobot.se/v2.1"

    def is_available(self) -> bool:
        """Check if Trafiklab API is available (has API key)."""
        return self.api_key is not None

    def find_nearby_stops(
        self,
        center: Tuple[float, float],
        radius_m: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        Find nearby transit stops using ResRobot.

        Args:
            center: (lat, lon) tuple
            radius_m: Search radius in meters

        Returns:
            List of nearby stops with details
        """
        if not self.is_available():
            print("⚠️  Trafiklab API key not available, skipping transit data")
            return []

        try:
            lat, lon = center

            params = {
                "accessId": self.api_key,  # ResRobot uses accessId, not key
                "originCoordLat": lat,
                "originCoordLong": lon,
                "maxDist": radius_m,
                "format": "json"
            }

            response = requests.get(
                f"{self.resrobot_base_url}/location.nearbystops",
                params=params,
                timeout=10
            )
            response.raise_for_status()

            data = response.json()

            stops = []
            for stop in data.get("stopLocationOrCoordLocation", []):
                if "StopLocation" not in stop:
                    continue

                stop_data = stop["StopLocation"]

                stops.append({
                    "id": stop_data.get("id"),
                    "name": stop_data.get("name"),
                    "coordinates": (
                        float(stop_data.get("lat", 0)),
                        float(stop_data.get("lon", 0))
                    ),
                    "distance_m": int(stop_data.get("dist", 0)),
                    "products": stop_data.get("products", [])  # Transit types available
                })

            # Sort by distance
            stops.sort(key=lambda x: x["distance_m"])

            return stops

        except requests.RequestException as e:
            print(f"⚠️  Trafiklab nearby stops query failed: {str(e)}")
            return []
        except (KeyError, ValueError) as e:
            print(f"⚠️  Invalid Trafiklab response: {str(e)}")
            return []

    def get_travel_time(
        self,
        origin: Tuple[float, float],
        destination_name: str,
        destination_coords: Optional[Tuple[float, float]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Calculate travel time from origin to destination.

        Args:
            origin: (lat, lon) tuple
            destination_name: Destination name (e.g., "Stockholm C") for display
            destination_coords: Optional (lat, lon) tuple for destination.
                               If not provided, will use OSM to geocode destination_name.

        Returns:
            Dict with duration, transfers, and route description
        """
        if not self.is_available():
            return None

        try:
            lat, lon = origin

            # If destination coords not provided, try to geocode the name
            if not destination_coords:
                # For now, skip destinations we can't geocode
                # In production, you'd use OSM geocoding here
                print(f"⚠️  Destination coordinates required for {destination_name}")
                return None

            dest_lat, dest_lon = destination_coords

            # Use current time + 1 hour for travel planning
            departure_time = datetime.now() + timedelta(hours=1)

            params = {
                "accessId": self.api_key,  # ResRobot uses accessId, not key
                "originCoordLat": lat,
                "originCoordLong": lon,
                "destCoordLat": dest_lat,
                "destCoordLong": dest_lon,
                "date": departure_time.strftime("%Y-%m-%d"),
                "time": departure_time.strftime("%H:%M"),
                "format": "json"
            }

            response = requests.get(
                f"{self.resrobot_base_url}/trip",
                params=params,
                timeout=15
            )
            response.raise_for_status()

            data = response.json()

            trips = data.get("Trip", [])
            if not trips:
                return None

            # Get fastest trip (first result)
            trip = trips[0]

            # Parse duration - API returns duration as string like "PT1H17M"
            # or directly as minutes in 'duration' field
            duration_min = 0
            if "duration" in trip and trip["duration"]:
                # Duration in ISO 8601 format or as string
                duration_str = str(trip["duration"])
                if "PT" in duration_str:
                    # Parse ISO 8601 duration like "PT1H17M"
                    import re
                    hours = 0
                    minutes = 0

                    hour_match = re.search(r'(\d+)H', duration_str)
                    if hour_match:
                        hours = int(hour_match.group(1))

                    minute_match = re.search(r'(\d+)M', duration_str)
                    if minute_match:
                        minutes = int(minute_match.group(1))

                    duration_min = hours * 60 + minutes
                else:
                    # Try direct minute value
                    try:
                        duration_min = int(duration_str)
                    except ValueError:
                        duration_min = 0

            # Fallback: Calculate from Origin and Destination times if duration is 0
            if duration_min == 0:
                origin_time = trip.get("Origin", {}).get("time", "00:00:00")
                dest_time = trip.get("Destination", {}).get("time", "00:00:00")

                origin_h, origin_m = map(int, origin_time.split(":")[:2])
                dest_h, dest_m = map(int, dest_time.split(":")[:2])
                duration_min = (dest_h * 60 + dest_m) - (origin_h * 60 + origin_m)

            # Get transfer count from API
            transfers = trip.get("transferCount", 0)

            # Build route description
            route_parts = []
            leg_list = trip.get("LegList", {})
            if leg_list:
                legs = leg_list.get("Leg", [])
                # Ensure legs is a list
                if not isinstance(legs, list):
                    legs = [legs]

                for leg in legs:
                    if isinstance(leg, dict):
                        product = leg.get("Product")
                        # Product can be a dict or a list, handle both
                        if isinstance(product, dict):
                            line_name = product.get("line", product.get("catOutL", ""))
                            if line_name:
                                route_parts.append(line_name)
                        elif isinstance(product, list) and product:
                            # If Product is a list, use the first one
                            line_name = product[0].get("line", product[0].get("catOutL", ""))
                            if line_name:
                                route_parts.append(line_name)

            route_description = " → ".join(route_parts) if route_parts else "Direct"

            return {
                "destination": destination_name,
                "duration_min": duration_min,
                "transfers": transfers,
                "route_description": route_description,
                "departure_time": departure_time.strftime("%H:%M")
            }

        except requests.RequestException as e:
            print(f"⚠️  Trafiklab travel time query failed: {str(e)}")
            return None
        except (KeyError, ValueError, AttributeError) as e:
            print(f"⚠️  Invalid Trafiklab trip response: {str(e)}")
            return None

    def analyze_transit_frequency(
        self,
        stop_id: str,
        hours: int = 12
    ) -> Optional[Dict[str, Any]]:
        """
        Analyze departure frequency at a stop.

        Args:
            stop_id: Stop ID from nearby_stops
            hours: Number of hours to analyze

        Returns:
            Dict with frequency analysis
        """
        if not self.is_available():
            return None

        try:
            # Get departures for next X hours
            now = datetime.now()

            params = {
                "accessId": self.api_key,  # ResRobot uses accessId, not key
                "id": stop_id,
                "date": now.strftime("%Y-%m-%d"),
                "time": now.strftime("%H:%M"),
                "duration": hours * 60,  # Minutes
                "format": "json"
            }

            response = requests.get(
                f"{self.resrobot_base_url}/departureBoard",
                params=params,
                timeout=15
            )
            response.raise_for_status()

            data = response.json()

            departures = data.get("Departure", [])
            if not departures:
                return {
                    "total_departures": 0,
                    "average_frequency_min": 0,
                    "description": "No departures found"
                }

            total = len(departures)

            # Calculate average frequency
            avg_frequency = (hours * 60) / total if total > 0 else 0

            # Categorize frequency
            if avg_frequency <= 10:
                description = f"Avgång var {int(avg_frequency)}:e minut"
            elif avg_frequency <= 20:
                description = f"Avgång var {int(avg_frequency)}:e minut"
            elif avg_frequency <= 40:
                description = f"Avgång var {int(avg_frequency)}:e minut"
            else:
                description = f"Avgång var {int(avg_frequency)}:e minut"

            # Get unique lines
            lines = set()
            for dep in departures:
                if isinstance(dep, dict):
                    product = dep.get("Product", {})
                    # Product can be a dict or a list
                    if isinstance(product, list):
                        for p in product:
                            if isinstance(p, dict):
                                line = p.get("line", p.get("num", ""))
                                if line:
                                    lines.add(line)
                    elif isinstance(product, dict):
                        line = product.get("line", product.get("num", ""))
                        if line:
                            lines.add(line)

            return {
                "total_departures": total,
                "average_frequency_min": int(avg_frequency),
                "description": description,
                "lines": sorted(list(lines))
            }

        except requests.RequestException as e:
            print(f"⚠️  Trafiklab frequency query failed: {str(e)}")
            return None
        except (KeyError, ValueError, ZeroDivisionError) as e:
            print(f"⚠️  Invalid Trafiklab departure response: {str(e)}")
            return None

    def get_transit_analysis(
        self,
        center: Tuple[float, float],
        radius_m: int = 1000,
        destinations: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive transit analysis for an area.

        Args:
            center: (lat, lon) tuple
            radius_m: Search radius in meters
            destinations: List of destination names to check travel times

        Returns:
            Dict with transit analysis
        """
        print(f"🚌 Querying Trafiklab for transit data...")

        if not self.is_available():
            print("⚠️  Trafiklab API key not configured, skipping detailed transit analysis")
            return {
                "available": False,
                "message": "Trafiklab API key not configured"
            }

        # Find nearby stops
        nearby_stops = self.find_nearby_stops(center, radius_m)

        if not nearby_stops:
            return {
                "available": True,
                "nearby_stops": [],
                "message": "No transit stops found within radius"
            }

        print(f"   Found {len(nearby_stops)} nearby stops")

        # Analyze frequency for closest stops (max 3)
        frequency_data = {}
        for stop in nearby_stops[:3]:
            print(f"   Analyzing frequency for {stop['name']}...")
            freq = self.analyze_transit_frequency(stop["id"])
            if freq:
                frequency_data[stop["name"]] = freq

        # Get travel times to destinations
        travel_times = {}
        if destinations:
            for dest in destinations:
                print(f"   Calculating travel time to {dest}...")
                travel_time = self.get_travel_time(center, dest)
                if travel_time:
                    travel_times[dest] = travel_time

        # Build summary
        closest_stop = nearby_stops[0] if nearby_stops else None

        return {
            "available": True,
            "nearby_stops": nearby_stops[:10],  # Top 10 closest
            "closest_stop": closest_stop,
            "frequency_analysis": frequency_data,
            "travel_times": travel_times,
            "summary": self._summarize_transit(nearby_stops, frequency_data, travel_times)
        }

    def _summarize_transit(
        self,
        stops: List[Dict],
        frequency: Dict,
        travel_times: Dict
    ) -> Dict[str, Any]:
        """Summarize transit data into readable format."""
        if not stops:
            return {
                "quality": "poor",
                "description": "No transit stops nearby"
            }

        closest = stops[0]
        total_stops = len(stops)

        # Determine quality based on distance and frequency
        if closest["distance_m"] < 300 and frequency:
            quality = "excellent"
        elif closest["distance_m"] < 500:
            quality = "good"
        elif closest["distance_m"] < 1000:
            quality = "fair"
        else:
            quality = "poor"

        # Build description
        freq_desc = ""
        if frequency:
            first_freq = list(frequency.values())[0]
            freq_desc = f", {first_freq.get('description', '')}"

        description = f"Nearest stop: {closest['name']} ({closest['distance_m']}m){freq_desc}"

        return {
            "quality": quality,
            "description": description,
            "total_nearby_stops": total_stops
        }
