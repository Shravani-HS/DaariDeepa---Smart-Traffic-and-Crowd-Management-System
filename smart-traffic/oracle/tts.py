"""
tts.py — Text-to-Speech

Engines:
  gtts    → Google TTS (internet required, natural voice)
  pyttsx3 → Offline TTS (no internet, robotic but always works)
"""

import os
import sys
import platform
from config import Config


class TextToSpeech:
    def __init__(self, config: Config):
        self.config = config
        self.engine = config.tts_engine
        self.lang   = config.tts_language
        self.output = config.output_mp3

        # Pre-init pyttsx3 if needed
        self._pyttsx3_engine = None
        if self.engine == "pyttsx3":
            self._init_pyttsx3()

    def speak(self, text: str):
        """Convert text to speech and play it."""
        if not text or not text.strip():
            return
        try:
            if self.engine == "gtts":
                self._speak_gtts(text)
            else:
                self._speak_pyttsx3(text)
        except Exception as e:
            print(f"⚠️  TTS error ({self.engine}): {e}")
            # Try the other engine as a last resort
            if self.engine == "gtts":
                self._speak_pyttsx3(text)

    # ── gTTS ──────────────────────────────────────────────────────────────────

    def _speak_gtts(self, text: str):
        from gtts import gTTS
        tts = gTTS(text=text, lang=self.lang, slow=False)
        tts.save(self.output)
        self._play_file(self.output)

    # ── pyttsx3 ──────────────────────────────────────────────────────────────

    def _init_pyttsx3(self):
        try:
            import pyttsx3
            self._pyttsx3_engine = pyttsx3.init()
            self._pyttsx3_engine.setProperty("rate", 165)   # words/min
            self._pyttsx3_engine.setProperty("volume", 0.9)
        except Exception as e:
            print(f"⚠️  pyttsx3 init failed: {e}")

    def _speak_pyttsx3(self, text: str):
        if not self._pyttsx3_engine:
            self._init_pyttsx3()
        if self._pyttsx3_engine:
            self._pyttsx3_engine.say(text)
            self._pyttsx3_engine.runAndWait()

    # ── Audio playback (cross-platform) ──────────────────────────────────────

    def _play_file(self, path: str):
        system = platform.system()
        if system == "Windows":
            os.system(f'start "" "{path}"')
        elif system == "Darwin":        # macOS
            os.system(f'afplay "{path}"')
        else:                           # Linux / Raspberry Pi
            # Try multiple players in order of preference
            for player in ("mpg123", "mpg321", "ffplay -nodisp -autoexit", "aplay"):
                if os.system(f"which {player.split()[0]} >/dev/null 2>&1") == 0:
                    os.system(f'{player} "{path}" >/dev/null 2>&1')
                    return
            print("⚠️  No audio player found. Install mpg123: sudo apt install mpg123")
