"""
route_advisor.py — Route calculation and best-path selection

Primary source  : Your Daarideepa project (/api/route)
                  which already has the Leaflet map + traffic heatmap.
Fallback source : OpenRouteService (free tier, no credit card needed).
                  Sign up at https://openrouteservice.org/ for a free API key.
"""

import requests
from typing import Optional
from config import Config


# Default origin coordinates used when no "from" is specified.
# Update this to the user's typical starting area or make it dynamic.
DEFAULT_ORIGIN = "Bangalore, India"


class RouteAdvisor:
    def __init__(self, config: Config):
        self.config = config

    # ── Public interface ─────────────────────────────────────────────────────

    def get_best_route(self, destination: str, origin: str = DEFAULT_ORIGIN) -> dict:
        """
        Returns a dict with keys:
          name, distance_km, eta_min, traffic_level,
          alt_name, alt_eta_min, steps (list of turn-by-turn strings)
        """
        data = self._fetch_from_daari(destination, origin)
        if data:
            return self._normalise(data)

        if self.config.use_public_fallback and self.config.ors_api_key:
            data = self._fetch_from_ors(destination, origin)
            if data:
                return self._normalise_ors(data)

        # Last resort: honest unknown
        return {
            "name": "main road",
            "distance_km": "?",
            "eta_min": "?",
            "traffic_level": "unknown",
            "alt_name": None,
            "alt_eta_min": None,
            "steps": [],
        }

    def format_turn_by_turn(self, route: dict) -> str:
        """Return voice-friendly step string."""
        steps = route.get("steps", [])
        if not steps:
            return ""
        # Read first 3 steps — more would be overwhelming by voice
        return ". Then, ".join(steps[:3]) + "."

    # ── Daarideepa fetch ─────────────────────────────────────────────────────

    def _fetch_from_daari(self, destination: str, origin: str) -> Optional[dict]:
        url = self.config.daari_api_base + self.config.daari_route_endpoint
        try:
            r = requests.get(
                url,
                params={"origin": origin, "destination": destination},
                timeout=4,
            )
            r.raise_for_status()
            return r.json()
        except Exception as e:
            print(f"⚠️  Daari route fetch failed: {e}")
            return None

    def _normalise(self, data: dict) -> dict:
        """
        Normalise Daarideepa response to Oracle's expected schema.
        Adjust field names to match what your PyCharm project actually returns.
        """
        return {
            "name":          data.get("route_name", data.get("name", "recommended route")),
            "distance_km":   data.get("distance_km", data.get("distance", "?")),
            "eta_min":       data.get("eta_min", data.get("duration_min", data.get("eta", "?"))),
            "traffic_level": data.get("traffic_level", data.get("traffic", "moderate")),
            "alt_name":      data.get("alt_route_name", data.get("alternative_name")),
            "alt_eta_min":   data.get("alt_eta_min", data.get("alt_duration_min")),
            "steps":         data.get("steps", data.get("instructions", [])),
        }

    # ── OpenRouteService fallback ────────────────────────────────────────────

    def _fetch_from_ors(self, destination: str, origin: str) -> Optional[dict]:
        """
        Uses ORS geocode + directions. Free tier: 2000 req/day.
        Requires ORS_API_KEY in config / .env.
        """
        try:
            # Geocode origin
            origin_coords  = self._geocode_ors(origin)
            dest_coords    = self._geocode_ors(destination)
            if not origin_coords or not dest_coords:
                return None

            url = "https://api.openrouteservice.org/v2/directions/driving-car/json"
            payload = {
                "coordinates": [origin_coords, dest_coords],
                "instructions": True,
                "language": "en",
            }
            headers = {
                "Authorization": self.config.ors_api_key,
                "Content-Type": "application/json",
            }
            r = requests.post(url, json=payload, headers=headers, timeout=5)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            print(f"⚠️  ORS routing failed: {e}")
            return None

    def _geocode_ors(self, place: str) -> Optional[list]:
        url = "https://api.openrouteservice.org/geocode/search"
        try:
            r = requests.get(
                url,
                params={"api_key": self.config.ors_api_key, "text": place, "size": 1},
                timeout=4,
            )
            r.raise_for_status()
            features = r.json().get("features", [])
            if features:
                return features[0]["geometry"]["coordinates"]   # [lon, lat]
            return None
        except Exception:
            return None

    def _normalise_ors(self, data: dict) -> dict:
        try:
            route    = data["routes"][0]
            summary  = route["summary"]
            dist_km  = round(summary["distance"] / 1000, 1)
            eta_min  = round(summary["duration"] / 60)
            raw_steps = route["segments"][0]["steps"]
            steps = [s["instruction"] for s in raw_steps[:5]]
            return {
                "name":          "recommended route",
                "distance_km":   dist_km,
                "eta_min":       eta_min,
                "traffic_level": "unknown",
                "alt_name":      None,
                "alt_eta_min":   None,
                "steps":         steps,
            }
        except Exception as e:
            print(f"⚠️  ORS normalise failed: {e}")
            return {}


# ── Daarideepa bridge helper ──────────────────────────────────────────────────
# Add this route to your Daarideepa Flask app so Oracle can query it.
#
# @app.route("/api/route")
# def route_api():
#     origin      = request.args.get("origin", "")
#     destination = request.args.get("destination", "")
#     # Use your existing Leaflet / routing logic here
#     best = your_routing_function(origin, destination)
#     return jsonify({
#         "route_name":    best["name"],
#         "distance_km":   best["distance_km"],
#         "eta_min":       best["eta_min"],
#         "traffic_level": best["traffic_level"],
#         "alt_route_name": best.get("alt_name"),
#         "alt_eta_min":   best.get("alt_eta_min"),
#         "steps":         best.get("steps", []),
#     })
