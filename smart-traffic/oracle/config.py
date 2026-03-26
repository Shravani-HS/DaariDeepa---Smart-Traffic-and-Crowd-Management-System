"""
config.py — Central configuration for Oracle Voice Assistant.

Copy this file and fill in your values, or use a .env file.
All Daarideepa integration settings live here.
"""

import os
from dotenv import load_dotenv

load_dotenv()   # reads .env if present


class Config:
    # ── AI Backend ──────────────────────────────────────────────
    # "claude"  → Anthropic Claude (recommended)
    # "openai"  → OpenAI GPT-4o-mini
    ai_backend: str      = os.getenv("AI_BACKEND", "claude")
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    openai_api_key: str    = os.getenv("OPENAI_API_KEY", "")

    # ── Whisper STT ──────────────────────────────────────────────
    # "base" is fast, "small"/"medium" are more accurate
    whisper_model: str  = os.getenv("WHISPER_MODEL", "base")

    # ── TTS ──────────────────────────────────────────────────────
    # "gtts"   → Google TTS (requires internet, high quality)
    # "pyttsx3"→ offline TTS (no internet needed)
    tts_engine: str     = os.getenv("TTS_ENGINE", "gtts")
    tts_language: str   = os.getenv("TTS_LANGUAGE", "en")

    # ── Audio Recording ──────────────────────────────────────────
    record_seconds: int  = int(os.getenv("RECORD_SECONDS", "6"))
    sample_rate: int     = int(os.getenv("SAMPLE_RATE", "44100"))
    input_wav: str       = os.getenv("INPUT_WAV", "input.wav")
    output_mp3: str      = os.getenv("OUTPUT_MP3", "voice.mp3")

    # ── Wake Word ────────────────────────────────────────────────
    wake_word: str            = os.getenv("WAKE_WORD", "oracle")
    require_wake_word: bool   = os.getenv("REQUIRE_WAKE_WORD", "false").lower() == "true"

    # ── Daarideepa Integration ───────────────────────────────────
    # Point this at your PyCharm project's local server.
    # If Daarideepa exposes a Flask route like /api/traffic or /api/route
    # set this base URL accordingly.
    daari_api_base: str = os.getenv("DAARI_API_BASE", "http://localhost:5000")

    # Endpoint paths (adjust to match your Daarideepa routes)
    daari_route_endpoint: str   = os.getenv("DAARI_ROUTE_EP",   "/api/route")
    daari_traffic_endpoint: str = os.getenv("DAARI_TRAFFIC_EP", "/api/traffic")
    daari_parking_endpoint: str = os.getenv("DAARI_PARKING_EP", "/api/parking")

    # Fallback: if Daarideepa is unreachable, use public APIs instead
    use_public_fallback: bool   = os.getenv("USE_PUBLIC_FALLBACK", "true").lower() == "true"

    # OpenRouteService API key (free, used as fallback for routing)
    ors_api_key: str = os.getenv("ORS_API_KEY", "")

    # Overpass / OSM — no key needed, free
    osm_overpass_url: str = "https://overpass-api.de/api/interpreter"

    # ── Conversation ──────────────────────────────────────────────
    # How many turns of dialogue to remember
    max_history_turns: int = int(os.getenv("MAX_HISTORY_TURNS", "10"))

    # ── System prompt (persona) ──────────────────────────────────
    system_prompt: str = (
        "You are Oracle, a smart real-time traffic and navigation voice assistant "
        "similar to Google Maps but more conversational. "
        "You help drivers with: best routes, live traffic conditions, estimated travel times, "
        "parking availability, road incidents, and alternate routes. "
        "Speak in short, clear sentences suitable for listening — no bullet points, "
        "no markdown. When giving directions, say them naturally as a human navigator would. "
        "Always mention traffic severity (light/moderate/heavy) and ETA when relevant. "
        "If asked about parking, mention walking distance to destination. "
        "Be proactive — if traffic ahead is bad on the user's route, warn them unprompted."
    )
