"""
Oracle Voice Assistant — main.py
Entry point. Runs the full conversation loop:
  mic → STT → brain (Claude/GPT) → route/traffic/parking tools → TTS → speaker

Integration note for Daarideepa:
  Set DAARI_API_BASE in config.py (or .env) to point to your PyCharm
  project's local Flask/FastAPI server. The traffic_api module will
  automatically pull heatmap and route data from it.
"""

import sys
import signal
import threading
from config import Config
from stt import SpeechToText
from brain import OracleBrain
from tts import TextToSpeech
from audio_io import AudioRecorder, play_audio

def handle_exit(sig, frame):
    print("\n👋 Oracle shutting down.")
    sys.exit(0)

signal.signal(signal.SIGINT, handle_exit)


def oracle_loop():
    config = Config()
    stt    = SpeechToText(config)
    brain  = OracleBrain(config)
    tts    = TextToSpeech(config)
    mic    = AudioRecorder(config)

    print("=" * 55)
    print("  Oracle Voice Assistant  |  Traffic + Navigation AI")
    print("=" * 55)
    print(f"  Daari endpoint : {config.daari_api_base}")
    print(f"  AI backend     : {config.ai_backend}")
    print(f"  Wake word      : '{config.wake_word}'  (or press Enter)")
    print("  Ctrl+C to quit")
    print("=" * 55)

    tts.speak("Oracle is ready. Say " + config.wake_word + " or ask me anything about traffic and routes.")

    while True:
        try:
            # ── 1. Record ────────────────────────────────────────
            audio_path = mic.record()
            if audio_path is None:
                continue

            # ── 2. Transcribe ────────────────────────────────────
            user_text = stt.transcribe(audio_path)
            if not user_text or len(user_text.strip()) < 2:
                continue
            print(f"\n🎤 You : {user_text}")

            # ── 3. Skip if not directed at Oracle ────────────────
            if config.require_wake_word:
                if config.wake_word.lower() not in user_text.lower():
                    continue

            # ── 4. Think ─────────────────────────────────────────
            response = brain.respond(user_text)
            print(f"🧠 Oracle : {response}\n")

            # ── 5. Speak ─────────────────────────────────────────
            tts.speak(response)

        except KeyboardInterrupt:
            handle_exit(None, None)
        except Exception as e:
            print(f"⚠️  Loop error: {e}")
            tts.speak("Sorry, something went wrong. Please try again.")


if __name__ == "__main__":
    oracle_loop()
