"""
Crowd Detection API Routes
Add these routes to your existing app.py / main.py
"""

# ============================================================
# ADD THESE IMPORTS at the top of your app.py
# ============================================================
# from crowd_predictor import predict_crowd_for_location, get_all_locations_crowd_summary
# from crowd_data import BANGALORE_CROWD_LOCATIONS, get_location_by_id

# ============================================================
# ADD THESE ROUTES to your existing Flask app
# ============================================================

"""
@app.route('/api/crowd/locations', methods=['GET'])
def get_crowd_locations():
    \"\"\"Get all temples & malls with current crowd summary for map markers.\"\"\"
    try:
        summary = get_all_locations_crowd_summary()
        return jsonify({
            "success": True,
            "locations": summary,
            "total": len(summary)
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/crowd/predict/<location_id>', methods=['GET'])
def get_crowd_prediction(location_id):
    \"\"\"Get detailed AI crowd prediction for a specific location.\"\"\"
    try:
        prediction = predict_crowd_for_location(location_id)
        if "error" in prediction:
            return jsonify({"success": False, "error": prediction["error"]}), 404
        return jsonify({"success": True, "data": prediction})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/crowd/locations/list', methods=['GET'])
def list_crowd_locations():
    \"\"\"List all available locations with basic info.\"\"\"
    from crowd_data import BANGALORE_CROWD_LOCATIONS
    data = {
        "temples": [{"id": t["id"], "name": t["name"], "lat": t["lat"], "lng": t["lng"], "icon": t["icon"]} 
                    for t in BANGALORE_CROWD_LOCATIONS["temples"]],
        "malls": [{"id": m["id"], "name": m["name"], "lat": m["lat"], "lng": m["lng"], "icon": m["icon"]} 
                  for m in BANGALORE_CROWD_LOCATIONS["malls"]]
    }
    return jsonify({"success": True, "data": data})
"""

# ============================================================
# STANDALONE FLASK APP (for testing crowd routes independently)
# ============================================================

from flask import Flask, jsonify, request
from crowd_predictor import predict_crowd_for_location, get_all_locations_crowd_summary
from crowd_data import BANGALORE_CROWD_LOCATIONS

app = Flask(__name__)

@app.route('/api/crowd/locations', methods=['GET'])
def get_crowd_locations():
    try:
        summary = get_all_locations_crowd_summary()
        return jsonify({"success": True, "locations": summary, "total": len(summary)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

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
    data = {
        "temples": [{"id": t["id"], "name": t["name"], "lat": t["lat"], "lng": t["lng"], "icon": t["icon"]} 
                    for t in BANGALORE_CROWD_LOCATIONS["temples"]],
        "malls": [{"id": m["id"], "name": m["name"], "lat": m["lat"], "lng": m["lng"], "icon": m["icon"]} 
                  for m in BANGALORE_CROWD_LOCATIONS["malls"]]
    }
    return jsonify({"success": True, "data": data})

if __name__ == '__main__':
    app.run(debug=True, port=5001)
