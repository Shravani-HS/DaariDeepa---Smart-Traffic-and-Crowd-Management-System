"""
AI Crowd Predictor for Bangalore Temples and Malls
Uses time-based patterns, day-of-week analysis, and simulated camera feeds
to predict real-time crowd levels at each gate
"""

import random
import math
from datetime import datetime, timedelta
from .crowd_data import BANGALORE_CROWD_LOCATIONS, get_location_by_id


def get_time_factor(hour: int, minute: int, peak_hours: list) -> float:
    """Returns a 0.0-1.0 crowd factor based on current time vs peak hours."""
    current_minutes = hour * 60 + minute
    
    max_factor = 0.1  # baseline
    for ph in peak_hours:
        parts = ph.split("-")
        if len(parts) == 2:
            sh, sm = parts[0].strip().split(":")
            eh, em = parts[1].strip().split(":")
            start = int(sh) * 60 + int(sm)
            end = int(eh) * 60 + int(em)
            # Bell curve around peak center
            center = (start + end) / 2
            spread = (end - start) / 2
            if spread > 0:
                dist = abs(current_minutes - center)
                factor = math.exp(-(dist ** 2) / (2 * (spread ** 1.5) ** 2))
                # Higher factor during peak
                if start <= current_minutes <= end:
                    factor = max(factor, 0.7)
                max_factor = max(max_factor, factor)
    
    return min(max_factor, 1.0)


def get_day_factor(weekday: str, weekly_peak: list) -> float:
    """Returns multiplier based on day of week."""
    if weekday in weekly_peak:
        return random.uniform(0.8, 1.0)
    elif weekday in ["Saturday", "Sunday"]:
        return random.uniform(0.6, 0.85)
    else:
        return random.uniform(0.2, 0.55)


def get_gate_base_factor(gate: dict) -> float:
    """Base crowd tendency for a gate."""
    mapping = {"high": 0.7, "medium": 0.45, "low": 0.2}
    return mapping.get(gate.get("typical_crowd", "medium"), 0.45)


def simulate_camera_reading(base_crowd: float, gate_id: str) -> dict:
    """Simulate AI camera crowd reading with realistic noise."""
    seed = int(datetime.now().timestamp() / 30)  # changes every 30s
    rng = random.Random(f"{gate_id}_{seed}")
    
    noise = rng.gauss(0, 0.08)
    crowd_ratio = max(0.0, min(1.0, base_crowd + noise))
    
    # Detect anomalies (sudden spikes)
    anomaly = rng.random() < 0.05  # 5% chance of anomaly
    if anomaly:
        crowd_ratio = min(1.0, crowd_ratio + rng.uniform(0.15, 0.3))
    
    wait_minutes = int(crowd_ratio * 25)  # max 25 min wait
    
    if crowd_ratio >= 0.8:
        level = "critical"
        color = "#FF2D55"
        emoji = "🔴"
        label = "Very Crowded"
    elif crowd_ratio >= 0.6:
        level = "high"
        color = "#FF9500"
        emoji = "🟠"
        label = "Crowded"
    elif crowd_ratio >= 0.35:
        level = "medium"
        color = "#FFCC00"
        emoji = "🟡"
        label = "Moderate"
    elif crowd_ratio >= 0.15:
        level = "low"
        color = "#30D158"
        emoji = "🟢"
        label = "Light"
    else:
        level = "empty"
        color = "#0A84FF"
        emoji = "🔵"
        label = "Very Light"
    
    return {
        "crowd_ratio": round(crowd_ratio, 3),
        "crowd_percentage": int(crowd_ratio * 100),
        "level": level,
        "color": color,
        "emoji": emoji,
        "label": label,
        "wait_minutes": wait_minutes,
        "anomaly_detected": anomaly,
        "camera_confidence": round(rng.uniform(0.88, 0.99), 2),
        "person_count_estimate": int(crowd_ratio * 100 * rng.uniform(0.9, 1.1))  # relative
    }


def predict_crowd_for_location(location_id: str) -> dict:
    """Main function: predict crowd at each gate of a location."""
    location = get_location_by_id(location_id)
    if not location:
        return {"error": "Location not found"}
    
    now = datetime.now()
    weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    weekday = weekdays[now.weekday()]
    
    time_factor = get_time_factor(now.hour, now.minute, location["peak_hours"])
    day_factor = get_day_factor(weekday, location["weekly_peak"])
    
    overall_pressure = time_factor * day_factor
    
    gate_predictions = []
    best_gate = None
    best_score = float('inf')
    
    for gate in location["gates"]:
        base = get_gate_base_factor(gate)
        # Gates have individual variation
        gate_pressure = overall_pressure * (0.7 + base * 0.6)
        camera_data = simulate_camera_reading(gate_pressure, gate["id"])
        
        gate_info = {
            **gate,
            **camera_data,
            "timestamp": now.isoformat(),
        }
        gate_predictions.append(gate_info)
        
        # Best gate = lowest crowd with accessibility
        score = camera_data["crowd_ratio"]
        if score < best_score:
            best_score = score
            best_gate = gate["id"]
    
    # Overall location crowd
    avg_crowd = sum(g["crowd_ratio"] for g in gate_predictions) / len(gate_predictions)
    
    # Predict next 1 hour trend
    future_factors = []
    for delta_min in [15, 30, 45, 60]:
        future_time = now + timedelta(minutes=delta_min)
        ff = get_time_factor(future_time.hour, future_time.minute, location["peak_hours"])
        future_factors.append(round(ff * day_factor, 2))
    
    if future_factors[-1] > avg_crowd:
        trend = "increasing"
        trend_icon = "📈"
    elif future_factors[-1] < avg_crowd - 0.1:
        trend = "decreasing"
        trend_icon = "📉"
    else:
        trend = "stable"
        trend_icon = "➡️"
    
    return {
        "location_id": location_id,
        "location_name": location["name"],
        "location_type": location["type"],
        "current_time": now.strftime("%H:%M"),
        "current_day": weekday,
        "overall_crowd_percentage": int(avg_crowd * 100),
        "overall_pressure": round(overall_pressure, 2),
        "trend": trend,
        "trend_icon": trend_icon,
        "forecast_15min": int(future_factors[0] * 100),
        "forecast_30min": int(future_factors[1] * 100),
        "forecast_60min": int(future_factors[3] * 100),
        "best_gate_id": best_gate,
        "gates": gate_predictions,
        "peak_hours": location["peak_hours"],
        "is_peak_time": time_factor > 0.6,
        "ai_recommendation": generate_recommendation(gate_predictions, best_gate, location)
    }


def generate_recommendation(gate_predictions, best_gate_id, location):
    """AI-generated recommendation text."""
    best = next((g for g in gate_predictions if g["id"] == best_gate_id), None)
    if not best:
        return "Use any available entrance."
    
    worst = max(gate_predictions, key=lambda g: g["crowd_ratio"])
    
    rec = f"Use {best['name']} ({best['label']} crowd, ~{best['wait_minutes']} min wait). "
    
    if best["crowd_ratio"] < 0.3:
        rec += "Excellent time to visit - very manageable crowds. "
    elif best["crowd_ratio"] < 0.6:
        rec += "Moderate wait expected. Consider arriving 10 mins early. "
    else:
        rec += "All gates are busy. Expect delays. Off-peak visit recommended. "
    
    if worst["id"] != best_gate_id:
        rec += f"Avoid {worst['name']} ({worst['label']} crowd)."
    
    return rec


def get_all_locations_crowd_summary():
    """Quick crowd summary for all locations (for map markers)."""
    summary = []
    all_locs = []
    for loc in BANGALORE_CROWD_LOCATIONS["temples"]:
        all_locs.append(loc)
    for loc in BANGALORE_CROWD_LOCATIONS["malls"]:
        all_locs.append(loc)
    
    now = datetime.now()
    weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    weekday = weekdays[now.weekday()]
    
    for loc in all_locs:
        tf = get_time_factor(now.hour, now.minute, loc["peak_hours"])
        df = get_day_factor(weekday, loc["weekly_peak"])
        overall = tf * df
        
        rng = random.Random(f"{loc['id']}_{int(now.timestamp() / 60)}")
        crowd = max(0.05, min(0.95, overall + rng.gauss(0, 0.1)))
        
        if crowd >= 0.7:
            level, color, emoji = "high", "#FF2D55", "🔴"
        elif crowd >= 0.4:
            level, color, emoji = "medium", "#FF9500", "🟠"
        else:
            level, color, emoji = "low", "#30D158", "🟢"
        
        summary.append({
            "id": loc["id"],
            "name": loc["name"],
            "type": loc["type"],
            "lat": loc["lat"],
            "lng": loc["lng"],
            "icon": loc.get("icon", "📍"),
            "crowd_level": level,
            "crowd_percentage": int(crowd * 100),
            "crowd_color": color,
            "crowd_emoji": emoji,
            "gate_count": len(loc["gates"])
        })
    
    return summary
