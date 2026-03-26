"""
traffic_api.py — Real-time traffic data layer

Primary source  : Your Daarideepa PyCharm project's API
                  (GET /api/traffic → JSON with heatmap density data)
Fallback source : OpenRouteService / TomTom public APIs
"""

import requests
import json
import time
from typing import Optional
from config import Config


class TrafficAPI:
    def __init__(self, config: Config):
        self.config     = config
        self._cache     = {}
        self._cache_ttl = 60   # seconds — traffic data ages fast

    # ── Public methods ───────────────────────────────────────────────────────

    def get_area_summary(self, brief: bool = False) -> str:
        """Return a text summary of current area-wide traffic."""
        data = self._fetch_traffic_summary()
        if not data:
            return "Traffic data is currently unavailable."

        level = data.get("overall_level", "moderate")
        incidents = data.get("incident_count", 0)
        hotspots   = data.get("hotspots", [])

        if brief:
            return f"Traffic is {level} overall."

        parts = [f"Traffic is {level} overall."]
        if incidents:
            parts.append(f"There {'is' if incidents == 1 else 'are'} {incidents} incident{'s' if incidents != 1 else ''} reported.")
        if hotspots:
            parts.append(f"Heavy congestion near {', '.join(hotspots[:2])}.")
        return " ".join(parts)

    def get_traffic_on_route(self, destination: str) -> dict:
        """Return traffic conditions specifically on the route to a destination."""
        data = self._fetch_route_traffic(destination)
        if not data:
            return {"summary": "Traffic data unavailable.", "incidents": "none"}
        return data

    # ── Daarideepa API calls ─────────────────────────────────────────────────

    def _fetch_traffic_summary(self) -> Optional[dict]:
        cache_key = "summary"
        if self._is_fresh(cache_key):
            return self._cache[cache_key]["data"]

        url = self.config.daari_api_base + self.config.daari_traffic_endpoint
        try:
            r = requests.get(url, timeout=3)
            r.raise_for_status()
            data = r.json()
            self._set_cache(cache_key, data)
            return data
        except Exception as e:
            print(f"⚠️  Daarideepa traffic fetch failed: {e}")
            if self.config.use_public_fallback:
                return self._fallback_traffic_summary()
            return None

    def _fetch_route_traffic(self, destination: str) -> Optional[dict]:
        cache_key = f"route_{destination}"
        if self._is_fresh(cache_key):
            return self._cache[cache_key]["data"]

        url = self.config.daari_api_base + self.config.daari_traffic_endpoint
        try:
            r = requests.get(url, params={"destination": destination}, timeout=3)
            r.raise_for_status()
            data = r.json()
            self._set_cache(cache_key, data)
            return data
        except Exception as e:
            print(f"⚠️  Route traffic fetch failed: {e}")
            if self.config.use_public_fallback:
                return self._fallback_route_traffic(destination)
            return None

    # ── Public fallback (OpenRouteService / static estimate) ─────────────────

    def _fallback_traffic_summary(self) -> dict:
        """
        If Daarideepa is offline, estimate from time-of-day heuristic.
        Replace with a real public traffic API key if available.
        """
        from datetime import datetime
        hour = datetime.now().hour
        if 7 <= hour <= 9 or 17 <= hour <= 19:
            level, incidents = "heavy", 2
        elif 10 <= hour <= 16:
            level, incidents = "moderate", 0
        else:
            level, incidents = "light", 0
        return {
            "overall_level": level,
            "incident_count": incidents,
            "hotspots": [],
            "source": "time_heuristic"
        }

    def _fallback_route_traffic(self, destination: str) -> dict:
        summary = self._fallback_traffic_summary()
        return {
            "summary": f"Traffic on the way to {destination} is {summary['overall_level']}.",
            "incidents": "none reported",
            "source": "time_heuristic"
        }

    # ── Cache helpers ────────────────────────────────────────────────────────

    def _is_fresh(self, key: str) -> bool:
        if key not in self._cache:
            return False
        return (time.time() - self._cache[key]["ts"]) < self._cache_ttl

    def _set_cache(self, key: str, data: dict):
        self._cache[key] = {"data": data, "ts": time.time()}


# ── Daarideepa bridge helper ──────────────────────────────────────────────────
# Add this to your Daarideepa Flask app (daari_bridge.py) to expose
# the heatmap data that Oracle needs.
#
# from flask import Flask, jsonify, request
# from your_existing_traffic_logic import get_heatmap_data, get_route_incidents
#
# @app.route("/api/traffic")
# def traffic():
#     destination = request.args.get("destination")
#     heatmap = get_heatmap_data()
#     level = "heavy" if heatmap["density"] > 0.7 else "moderate" if heatmap["density"] > 0.4 else "light"
#     return jsonify({
#         "overall_level": level,
#         "incident_count": len(heatmap.get("incidents", [])),
#         "hotspots": heatmap.get("hotspot_names", []),
#         "summary": f"Traffic is {level}.",
#         "incidents": ", ".join(heatmap.get("incidents", ["none"])),
#     })
