from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import io
import subprocess
import threading
import numpy as np
import soundfile as sf
from kokoro import KPipeline

HOST = "127.0.0.1"
PORT = 8765

print("Loading Kokoro Adam voice...")
pipeline = KPipeline(lang_code="a")
model_lock = threading.Lock()
print("Kokoro is ready.")

class Handler(BaseHTTPRequestHandler):
    def send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors()
        self.end_headers()

    def do_POST(self):
        if self.path != "/tts":
            self.send_error(404)
            return

        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > 100000:
                raise ValueError("Invalid request size")

            payload = json.loads(self.rfile.read(size))
            text = str(payload.get("text", "")).strip()

            if not text:
                raise ValueError("No text was supplied")
            if len(text) > 5000:
                raise ValueError("Paragraph is too long")

            print(f"Generating narration: {text[:75]}...")

            with model_lock:
                chunks = []
                for _, _, audio in pipeline(text, voice="am_adam"):
                    if hasattr(audio, "detach"):
                        audio = audio.detach().cpu().numpy()
                    chunks.append(np.asarray(audio).reshape(-1))

            if not chunks:
                raise RuntimeError("Kokoro did not generate audio")

            audio_data = np.concatenate(chunks)
            original = io.BytesIO()
            sf.write(original, audio_data, 24000, format="WAV")

            result = subprocess.run(
                [
                    "ffmpeg", "-hide_banner", "-loglevel", "error",
                    "-i", "pipe:0",
                    "-af",
                    "highpass=f=140,lowpass=f=6500,"
                    "equalizer=f=3000:t=q:w=1:g=3,"
                    "acompressor=threshold=0.08:ratio=2:attack=20:release=250,"
                    "aecho=0.8:0.7:70:0.18,volume=0.85",
                    "-f", "wav", "pipe:1"
                ],
                input=original.getvalue(),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=True
            )

            wav = result.stdout
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(wav)))
            self.send_cors()
            self.end_headers()
            self.wfile.write(wav)

        except Exception as exc:
            message = json.dumps({"error": str(exc)}).encode()
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(message)))
            self.send_cors()
            self.end_headers()
            self.wfile.write(message)
            print("TTS ERROR:", exc)

    def log_message(self, format, *args):
        print(*args)

print(f"Starting local narration service at http://{HOST}:{PORT}")
ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
