# Oracle Voice Assistant 🗺️

A real-time, conversational traffic navigation assistant —  
think Google Maps meets Alexa, powered by Claude AI.

---

## Project structure

```
oracle_voice_assistant/
├── main.py            ← Entry point — run this
├── brain.py           ← AI brain (Claude/GPT + conversation memory)
├── stt.py             ← Speech-to-text (Whisper)
├── tts.py             ← Text-to-speech (gTTS / pyttsx3)
├── audio_io.py        ← Microphone recording + silence detection
├── traffic_api.py     ← Pulls traffic from Daarideepa heatmap
├── route_advisor.py   ← Best route logic (Daarideepa + ORS fallback)
├── parking.py         ← Parking finder (Daarideepa + OSM fallback)
├── config.py          ← All settings (reads from .env)
├── daari_bridge.py    ← PASTE THIS into your Daarideepa project ←
├── requirements.txt
└── .env.example       ← Copy to .env and fill in your keys
```

---

## Quick start

### 1. Install dependencies

```bash
pip install -r requirements.txt

# Linux also needs:
sudo apt install mpg123 portaudio19-dev
pip install sounddevice scipy
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env and add your API keys
```

### 3. Integrate with Daarideepa

**In your Daarideepa PyCharm project:**

```python
# app.py (your main Flask file)
from daari_bridge import oracle_bp
app.register_blueprint(oracle_bp)
```

Then fill in the three `# TODO` sections in `daari_bridge.py` with your  
actual heatmap data and routing functions.

**In Oracle's `.env`:**
```
DAARI_API_BASE=http://localhost:5000
```

### 4. Run

```bash
# Terminal 1: start your Daarideepa Flask server
cd /path/to/daarideepa
python app.py

# Terminal 2: start Oracle
cd oracle_voice_assistant
python main.py
```

---

## What Oracle can do

| You say | Oracle does |
|---------|------------|
| "Oracle, take me to Koramangala" | Best route + ETA from live heatmap |
| "How's the traffic on MG Road?" | Real-time congestion level |
| "Is there parking near Forum Mall?" | Nearest slots + fees |
| "How long will it take?" | ETA with traffic delay |
| "Is there a faster route?" | Alternate route comparison |
| "What's the traffic like right now?" | Area-wide summary |

---

## Data flow

```
Microphone
   ↓
Whisper STT (local, offline)
   ↓
Intent detection (route / traffic / parking)
   ↓
Daarideepa API ──→ Traffic heatmap data
   ↓                Route calculations
   ↓                Parking info
Claude AI brain (with conversation memory)
   ↓
gTTS voice response
   ↓
Speaker
```

---

## Fallback chain

If any service is unavailable, Oracle degrades gracefully:

```
Daarideepa API offline?
  → OpenRouteService (free, needs ORS_API_KEY)
     → OpenStreetMap Overpass (free, no key)
        → Time-of-day heuristic estimate

Claude offline?
  → GPT-4o-mini
     → Keyword-based response

gTTS offline?
  → pyttsx3 (fully offline)
```

---

## Daari bridge API contract

Oracle expects these endpoints from Daarideepa:

### GET /api/traffic
```json
{
  "overall_level": "moderate",
  "incident_count": 2,
  "incidents": "accident on Hosur Road",
  "hotspots": ["Silk Board", "MG Road"],
  "summary": "Traffic is moderate.",
  "heatmap_density": 0.55
}
```

### GET /api/route?origin=...&destination=...
```json
{
  "route_name": "NH 44 via Hosur Road",
  "distance_km": 12.4,
  "eta_min": 28,
  "traffic_level": "moderate",
  "steps": ["Head south on Brigade Road", "..."],
  "alt_route_name": "Outer Ring Road",
  "alt_eta_min": 22
}
```

### GET /api/parking?destination=...&radius=500
```json
{
  "parking_lots": [
    {
      "name": "Forum Mall Parking",
      "distance_m": 120,
      "available_spaces": 45,
      "fee": "₹40/hour"
    }
  ]
}
```

---

## Conversation memory

Oracle remembers the last 10 turns of conversation, so you can say:
- "Go to Indiranagar"
- "How long will that take?"   ← Oracle knows the destination
- "Is there a faster route?"   ← Oracle knows the context

---

## Tips

- Set `REQUIRE_WAKE_WORD=true` in `.env` if you want Oracle to only  
  respond when you say "Oracle" first (Alexa-style).
- Set `WHISPER_MODEL=small` for better accuracy in noisy environments.
- Set `TTS_ENGINE=pyttsx3` for completely offline operation.
