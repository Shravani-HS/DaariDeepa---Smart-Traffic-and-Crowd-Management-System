from flask import Flask, render_template, request, jsonify
import requests
from oracle.daari_bridge import oracle_bp
from oracle.crowd_predictor import predict_crowd_for_location, get_all_locations_crowd_summary
from oracle.crowd_data import BANGALORE_CROWD_LOCATIONS, get_location_by_id
from flask import render_template, redirect, url_for, session


# ── Your existing routes below — unchanged ───────────────
app = Flask(__name__)

API_KEY = "5b3ce3597851110001cf62481c9cd101d5ed4dd192fe80531e4b52e7"
app.register_blueprint(oracle_bp)
@app.route('/')
def home():
    return render_template('route.html')

@app.route('/route')
def route():
    return render_template('route.html')


# ── GEOCODE ──────────────────────────────────────────────
@app.route('/geocode', methods=['POST'])
def geocode():
    place = request.json['place'] + ", Bangalore, India"

    url = f"https://api.openrouteservice.org/geocode/search"
    params = {
        "api_key": API_KEY,
        "text": place,
        "boundary.country": "IN",   # ✅ FORCE INDIA
        "size": 1
    }

    res = requests.get(url, params=params, timeout=10)
    return jsonify(res.json())

# ── ROUTING – returns up to 3 genuinely different routes ─
@app.route('/get-route', methods=['POST'])
def get_route():
    data = request.json
    start = data.get("start")   # [lat, lng]
    end = data.get("end")

    url = "https://api.openrouteservice.org/v2/directions/driving-car"

    body = {
        "coordinates": [
            [start[1], start[0]],   # lng, lat
            [end[1], end[0]]
        ],
        "instructions": False,
        "alternative_routes": {
            "target_count": 3,
            "weight_factor": 1.4,
            "share_factor": 0.6
        }
    }

    headers = {
        "Authorization": API_KEY,
        "Content-Type": "application/json"
    }

    res = requests.post(url, json=body, headers=headers)
    data = res.json()

    routes = []

    for r in data.get("routes", []):
        routes.append({
            "geometry": r["geometry"],  # encoded polyline
            "distance": r["summary"]["distance"],
            "duration": r["summary"]["duration"]
        })

    return jsonify({"routes": routes})
@app.route('/ai-traffic', methods=['POST'])
def ai_traffic():
    import requests

    data = request.json
    prompt = data.get("prompt")

    headers = {
        "x-api-key": "5b3ce3597851110001cf62481c9cd101d5ed4dd192fe80531e4b52e7",   # 🔥 PUT YOUR KEY HERE
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
    }

    body = {
        "model": "claude-3-sonnet-20240229",
        "max_tokens": 150,
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }

    res = requests.post(
        "https://api.anthropic.com/v1/messages",
        json=body,
        headers=headers
    )

    return jsonify(res.json())
@app.route('/api/crowd/locations', methods=['GET'])
def get_crowd_locations():

    try:
        summary = get_all_locations_crowd_summary()
        return jsonify({
            "success": True,
            "locations": summary,
            "total": len(summary)
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 50


@app.route('/api/crowd/predict/<location_id>', methods=['GET'])
def get_crowd_prediction(location_id):
    try:
        prediction = predict_crowd_for_location(location_id)
        if "error" in prediction:
            return jsonify({"success": False, "error": prediction["error"]}), 404
        return jsonify({"success": True, "data": prediction})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/crowd/locations/list', methods=['GET'])
def list_crowd_locations():
    from crowd_data import BANGALORE_CROWD_LOCATIONS
    data = {
        "temples": [{"id": t["id"], "name": t["name"], "lat": t["lat"], "lng": t["lng"], "icon": t["icon"]}
                    for t in BANGALORE_CROWD_LOCATIONS["temples"]],
        "malls": [{"id": m["id"], "name": m["name"], "lat": m["lat"], "lng": m["lng"], "icon": m["icon"]}
                  for m in BANGALORE_CROWD_LOCATIONS["malls"]]
    }
    return jsonify({"success": True, "data": data})
if __name__ == "__main__":
    app.run(debug=True)