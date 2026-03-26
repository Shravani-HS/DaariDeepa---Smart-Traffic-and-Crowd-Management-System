"""
parking.py — Nearby parking finder

Primary source  : Daarideepa (/api/parking)
Fallback source : OpenStreetMap Overpass API (completely free, no key)
"""

import requests
from typing import List, Optional
from config import Config


class ParkingFinder:
    def __init__(self, config: Config):
        self.config = config

    def find_nearby(self, destination: str, radius_m: int = 500) -> List[dict]:
        """
        Returns a list of parking options sorted by distance.
        Each dict: name, distance_m, available_spaces, fee, lat, lon
        """
        # Try Daarideepa first
        results = self._fetch_from_daari(destination, radius_m)
        if results:
            return results

        # Fallback: OSM Overpass
        coords = self._geocode_destination(destination)
        if coords:
            return self._fetch_from_osm(coords[0], coords[1], radius_m)

        return []

    # ── Daarideepa ────────────────────────────────────────────────────────────

    def _fetch_from_daari(self, destination: str, radius_m: int) -> List[dict]:
        url = self.config.daari_api_base + self.config.daari_parking_endpoint
        try:
            r = requests.get(
                url,
                params={"destination": destination, "radius": radius_m},
                timeout=3,
            )
            r.raise_for_status()
            data = r.json()
            return data.get("parking_lots", data if isinstance(data, list) else [])
        except Exception as e:
            print(f"⚠️  Daari parking fetch failed: {e}")
            return []

    # ── OSM Overpass fallback ─────────────────────────────────────────────────

    def _geocode_destination(self, destination: str) -> Optional[tuple]:
        """Geocode via Nominatim (free, no key)."""
        try:
            r = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": destination, "format": "json", "limit": 1},
                headers={"User-Agent": "OracleVoiceAssistant/1.0"},
                timeout=4,
            )
            r.raise_for_status()
            results = r.json()
            if results:
                return float(results[0]["lat"]), float(results[0]["lon"])
            return None
        except Exception as e:
            print(f"⚠️  Geocoding failed: {e}")
            return None

    def _fetch_from_osm(self, lat: float, lon: float, radius_m: int) -> List[dict]:
        """Query OSM for parking amenities near a point."""
        query = f"""
        [out:json][timeout:10];
        (
          node["amenity"="parking"]
            (around:{radius_m},{lat},{lon});
          way["amenity"="parking"]
            (around:{radius_m},{lat},{lon});
        );
        out center 5;
        """
        try:
            r = requests.post(
                self.config.osm_overpass_url,
                data={"data": query},
                timeout=8,
            )
            r.raise_for_status()
            elements = r.json().get("elements", [])
            lots = []
            for el in elements:
                tags = el.get("tags", {})
                c_lat = el.get("lat") or el.get("center", {}).get("lat", lat)
                c_lon = el.get("lon") or el.get("center", {}).get("lon", lon)
                dist  = self._haversine_m(lat, lon, c_lat, c_lon)
                lots.append({
                    "name":              tags.get("name", "Parking lot"),
                    "distance_m":        round(dist),
                    "available_spaces":  tags.get("capacity", "unknown"),
                    "fee":               tags.get("fee", "unknown"),
                    "access":            tags.get("access", "yes"),
                    "lat":               c_lat,
                    "lon":               c_lon,
                })
            return sorted(lots, key=lambda x: x["distance_m"])
        except Exception as e:
            print(f"⚠️  OSM parking fetch failed: {e}")
            return []

    @staticmethod
    def _haversine_m(lat1, lon1, lat2, lon2) -> float:
        """Distance in metres between two lat/lon points."""
        from math import radians, sin, cos, sqrt, atan2
        R = 6_371_000
        phi1, phi2 = radians(lat1), radians(lat2)
        dphi = radians(lat2 - lat1)
        dlam = radians(lon2 - lon1)
        a = sin(dphi/2)**2 + cos(phi1)*cos(phi2)*sin(dlam/2)**2
        return R * 2 * atan2(sqrt(a), sqrt(1-a))


# ── Daarideepa bridge helper ──────────────────────────────────────────────────
# @app.route("/api/parking")
# def parking_api():
#     destination = request.args.get("destination", "")
#     radius      = int(request.args.get("radius", 500))
#     lots = your_parking_logic(destination, radius)
#     return jsonify({"parking_lots": lots})
