"""
Kokoro TTS Backend Server

A lightweight FastAPI server that wraps kokoro-onnx for text-to-speech generation.

Setup (using uv):
  1. uv sync
  2. Download model files into this directory:
       wget https://github.com/nazdridoy/kokoro-tts/releases/download/v1.0.0/kokoro-v1.0.onnx
       wget https://github.com/nazdridoy/kokoro-tts/releases/download/v1.0.0/voices-v1.0.bin
  3. uv run python main.py
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io
import soundfile as sf
import numpy as np
from kokoro_onnx import Kokoro
import os

# Resolve paths relative to this script's directory so the server works
# regardless of which directory it is launched from.
_HERE = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.environ.get(
    "KOKORO_MODEL_PATH", os.path.join(_HERE, "kokoro-v1.0.onnx")
)
VOICES_PATH = os.environ.get(
    "KOKORO_VOICES_PATH", os.path.join(_HERE, "voices-v1.0.bin")
)

kokoro: Kokoro | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global kokoro
    missing = [p for p in (MODEL_PATH, VOICES_PATH) if not os.path.exists(p)]
    if missing:
        print("\n❌ Missing model files:")
        for p in missing:
            print(f"   {p}")
        print("\nDownload them into the server/ directory:")
        print(
            "   curl -L -o server/kokoro-v1.0.onnx  https://github.com/nazdridoy/kokoro-tts/releases/download/v1.0.0/kokoro-v1.0.onnx"
        )
        print(
            "   curl -L -o server/voices-v1.0.bin   https://github.com/nazdridoy/kokoro-tts/releases/download/v1.0.0/voices-v1.0.bin"
        )
    else:
        try:
            kokoro = Kokoro(MODEL_PATH, VOICES_PATH)
            voices = sorted(kokoro.get_voices())
            print(f"✅ Kokoro model loaded — {len(voices)} voices available")
        except Exception as e:
            print(f"⚠️  Failed to load Kokoro model: {e}")
    yield


app = FastAPI(title="Kokoro TTS Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TTSRequest(BaseModel):
    text: str
    voice: str = "af_heart"
    speed: float = 1.0
    lang: str = "en-us"


@app.get("/voices")
async def get_voices():
    if kokoro is None:
        raise HTTPException(
            503, "Kokoro model not loaded. See server logs for setup instructions."
        )
    voices = sorted(kokoro.get_voices())
    return {"voices": voices}


@app.get("/languages")
async def get_languages():
    if kokoro is None:
        raise HTTPException(503, "Kokoro model not loaded.")
    languages = sorted(kokoro.get_languages())
    return {"languages": languages}


@app.post("/tts")
async def text_to_speech(req: TTSRequest):
    if kokoro is None:
        raise HTTPException(
            503, "Kokoro model not loaded. See server logs for setup instructions."
        )
    try:
        samples, sample_rate = kokoro.create(
            req.text, voice=req.voice, speed=req.speed, lang=req.lang
        )

        buf = io.BytesIO()
        sf.write(buf, np.array(samples), sample_rate, format="WAV")
        buf.seek(0)

        return StreamingResponse(
            buf,
            media_type="audio/wav",
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except Exception as e:
        raise HTTPException(500, f"TTS generation failed: {str(e)}")


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": kokoro is not None}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8880)
