"""
daari_bridge.py — Paste this file into your Daarideepa PyCharm project.

This exposes the three REST endpoints that Oracle Voice Assistant queries:
  GET /api/traffic   → real-time traffic from your heatmap
  GET /api/route     → best route (uses your existing routing logic)
  GET /api/parking   → nearby parking

Usage:
  1. Copy this file into your Daarideepa project folder.
  2. Import and register the blueprint in your main Flask app:

       from daari_bridge import oracle_bp
       app.register_blueprint(oracle_bp)

  3. Fill in the three `# TODO` sections below with your actual logic.
  4. Run your Daarideepa Flask server on port 5000 (default).
  5. Set DAARI_API_BASE=http://localhost:5000 in Oracle's .env file.
"""

from flask import Blueprint, jsonify, request

oracle_bp = Blueprint("oracle", __name__, url_prefix="/api")


# ── /api/traffic ──────────────────────────────────────────────────────────────

@oracle_bp.route("/traffic")
def traffic():
    """
    Returns current traffic conditions.
    Query params:
      destination (optional) — filter to route towards a destination
    """
    destination = request.args.get("destination", "")

    # ─── TODO: replace with your Leaflet heatmap data ─────────────────────
    # Example: query your heatmap model / traffic database here
    # heatmap_data = get_heatmap_density()
    # incidents    = get_active_incidents()
    # hotspots     = get_hotspot_names()
    #
    # For now, returning sample structure — replace with real data:
    heatmap_density = 0.55   # 0.0 = no traffic, 1.0 = gridlock
    incidents       = []
    hotspots        = ["MG Road", "Silk Board"]
    # ─── end TODO ────────────────────────────────────────────────────────

    level = "heavy" if heatmap_density > 0.7 else "moderate" if heatmap_density > 0.4 else "light"

    route_summary = ""
    if destination:
        route_summary = f"Traffic on the way to {destination} is {level}."
    else:
        route_summary = f"Overall traffic is {level}."

    return jsonify({
        "overall_level":   level,
        "incident_count":  len(incidents),
        "incidents":       ", ".join(incidents) if incidents else "none",
        "hotspots":        hotspots,
        "summary":         route_summary,
        "heatmap_density": heatmap_density,
        "source":          "daari_heatmap",
    })


# ── /api/route ────────────────────────────────────────────────────────────────

@oracle_bp.route("/route")
def route():
    """
    Returns the best route from origin to destination.
    Query params:
      origin      — starting point (string address)
      destination — ending point (string address)
    """
    origin      = request.args.get("origin",      "current location")
    destination = request.args.get("destination", "")

    if not destination:
        return jsonify({"error": "destination is required"}), 400

    # ─── TODO: plug in your existing routing function ─────────────────────
    # Example:
    # best_route = your_routing_algorithm(origin, destination, traffic_heatmap)
    # alt_route  = your_alt_routing_algorithm(origin, destination)
    #
    # For now, returning sample structure:
    best_route = {
        "route_name":    "NH 44 via Hosur Road",
        "distance_km":   12.4,
        "eta_min":       28,
        "traffic_level": "moderate",
        "steps": [
            "Head south on Brigade Road",
            "Turn right onto MG Road",
            "Merge onto NH 44",
            f"Take exit towards {destination}",
        ],
    }
    alt_route = {
        "route_name":  "Outer Ring Road",
        "distance_km": 15.1,
        "eta_min":     22,
    }
    # ─── end TODO ────────────────────────────────────────────────────────

    return jsonify({
        "route_name":     best_route["route_name"],
        "distance_km":    best_route["distance_km"],
        "eta_min":        best_route["eta_min"],
        "traffic_level":  best_route["traffic_level"],
        "steps":          best_route["steps"],
        "alt_route_name": alt_route["route_name"],
        "alt_eta_min":    alt_route["eta_min"],
        "origin":         origin,
        "destination":    destination,
        "source":         "daari_router",
    })


# ── /api/parking ──────────────────────────────────────────────────────────────

@oracle_bp.route("/parking")
def parking():
    """
    Returns nearby parking options.
    Query params:
      destination — area to search near
      radius      — search radius in metres (default 500)
    """
    destination = request.args.get("destination", "")
    radius      = int(request.args.get("radius", 500))

    # ─── TODO: query your parking data source ────────────────────────────
    # Example: OSM, your own parking sensor data, Google Places, etc.
    # lots = get_parking_near(destination, radius)
    #
    # Sample structure:
    lots = [
        {
            "name":             "Forum Mall Parking",
            "distance_m":       120,
            "available_spaces": 45,
            "fee":              "₹40/hour",
            "lat":              12.9352,
            "lon":              77.6245,
        },
        {
            "name":             "Brigade Road Multilevel",
            "distance_m":       280,
            "available_spaces": 12,
            "fee":              "₹30/hour",
            "lat":              12.9742,
            "lon":              77.6099,
        },
    ]
    # ─── end TODO ────────────────────────────────────────────────────────

    return jsonify({
        "destination":  destination,
        "radius_m":     radius,
        "parking_lots": lots,
        "count":        len(lots),
    })


# ── Health check ──────────────────────────────────────────────────────────────

@oracle_bp.route("/health")
def health():
    return jsonify({"status": "ok", "service": "oracle-daari-bridge"})
@oracle_bp.route("/ask", methods=["POST"])
def ask():
    query = request.json.get("query", "").lower()

    if "go to" in query or "navigate" in query:
        destination = query.split("to")[-1].strip()
        return jsonify({
            "type": "route",
            "destination": destination,
            "reply": f"Showing routes to {destination}"
        })

    elif "parking here" in query:
        return jsonify({
            "type": "parking_here",
            "reply": "Showing parking near you"
        })

    elif "parking" in query:
        return jsonify({
            "type": "parking_destination",
            "reply": "Showing parking near destination"
        })

    elif "traffic" in query:
        return jsonify({
            "type": "traffic",
            "reply": "Analyzing traffic"
        })

    else:
        return jsonify({
            "type": "unknown",
            "reply": "Try saying go to Whitefield"
        })