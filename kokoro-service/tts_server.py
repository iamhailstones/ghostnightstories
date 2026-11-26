from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import io
import os
import subprocess
import threading
import time

import numpy as np
import soundfile as sf
from kokoro import KPipeline

HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "10000"))
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "*")

print("Loading Kokoro Adam voice...")
pipeline = KPipeline(lang_code="a")
model_lock = threading.Lock()
rate_lock = threading.Lock()
requests_by_ip = {}
print("Kokoro is ready.")


def allowed_request(ip):
    now = time.time()
    with rate_lock:
        recent = [
            stamp for stamp in requests_by_ip.get(ip, [])
            if now - stamp < 600
        ]
        if len(recent) >= 10:
            requests_by_ip[ip] = recent
            return False
        recent.append(now)
        requests_by_ip[ip] = recent
        return True


class Handler(BaseHTTPRequestHandler):
    def send_cors(self):
        self.send_header("Access-Control-Allow-Origin", FRONTEND_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Vary", "Origin")

    def send_json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {"status": "ok", "service": "kokoro-adam"})
        else:
            self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/tts":
            self.send_json(404, {"error": "Not found"})
            return

        ip = self.client_address[0]
        if not allowed_request(ip):
            self.send_json(429, {"error": "Too many requests. Try again later."})
            return

        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > 100000:
                self.send_json(400, {"error": "Invalid request size"})
                return

            payload = json.loads(self.rfile.read(size))
            text = str(payload.get("text", "")).strip()

            if not text:
                self.send_json(400, {"error": "No text was supplied"})
                return
            if len(text) > 5000:
                self.send_json(400, {"error": "Paragraph is too long"})
                return

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
                check=True,
                timeout=120
            )

            wav = result.stdout
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(wav)))
            self.send_cors()
            self.end_headers()
            self.wfile.write(wav)

        except Exception as exc:
            print("TTS ERROR:", exc)
            self.send_json(500, {"error": "Narration generation failed"})

    def log_message(self, format, *args):
        print(*args)


print(f"Starting public narration service on port {PORT}")
ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
