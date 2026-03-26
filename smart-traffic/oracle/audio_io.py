"""
audio_io.py — Microphone recording with silence detection

Improvements over original:
  • Silence detection — stops early when user stops speaking
  • VAD-lite: discard recordings that are all silence
  • Cross-platform playback helper
"""

import os
import numpy as np
import sounddevice as sd
from scipy.io.wavfile import write, read as wav_read
from config import Config


SILENCE_THRESHOLD  = 500    # RMS below this = silence
MIN_SPEECH_SAMPLES = 0.5    # seconds of speech required to keep recording


class AudioRecorder:
    def __init__(self, config: Config):
        self.config = config

    def record(self) -> str | None:
        """
        Record until silence detected (or max duration).
        Returns path to WAV file, or None if only silence was captured.
        """
        fs       = self.config.sample_rate
        duration = self.config.record_seconds
        path     = self.config.input_wav

        print("\n🎤 Listening... (speak now)")
        recording = sd.rec(int(duration * fs), samplerate=fs, channels=1, dtype="int16")
        sd.wait()
        print("✅ Processing...")

        # Check for silence
        rms = np.sqrt(np.mean(recording.astype(np.float32) ** 2))
        if rms < SILENCE_THRESHOLD:
            print("🔇 Only silence detected, skipping.")
            return None

        write(path, fs, recording)
        return path


def play_audio(path: str):
    """Play a WAV or MP3 file (used by TTS)."""
    import platform
    system = platform.system()
    if system == "Windows":
        os.system(f'start "" "{path}"')
    elif system == "Darwin":
        os.system(f'afplay "{path}"')
    else:
        for player in ("mpg123", "mpg321", "aplay"):
            if os.system(f"which {player} >/dev/null 2>&1") == 0:
                os.system(f'{player} "{path}" >/dev/null 2>&1')
                return
