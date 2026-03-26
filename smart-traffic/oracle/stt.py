"""
stt.py — Speech-to-Text using OpenAI Whisper (local, offline)
"""

import whisper
from config import Config


class SpeechToText:
    def __init__(self, config: Config):
        print(f"🔄 Loading Whisper model '{config.whisper_model}'...")
        self.model = whisper.load_model(config.whisper_model)
        print("✅ Whisper ready")

    def transcribe(self, audio_path: str) -> str:
        """Transcribe audio file → text string."""
        try:
            result = self.model.transcribe(audio_path, fp16=False)
            return result["text"].strip()
        except Exception as e:
            print(f"⚠️  STT error: {e}")
            return ""
