import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "backend" / "data.json"
OUTPUT = ROOT / "frontend" / "public" / "audio"

if not DATA_FILE.exists():
    sys.exit("ERROR: backend/data.json was not found.")

with DATA_FILE.open(encoding="utf-8") as f:
    data = json.load(f)

stories = [
    s for s in data.get("stories", [])
    if s.get("status") == "published"
]

if not stories:
    sys.exit("No published stories found.")

print("Loading Kokoro Adam voice...")
pipeline = KPipeline(lang_code="a")
print("Kokoro is ready.")

def make_audio(text):
    chunks = []

    for _, _, audio in pipeline(text, voice="am_adam"):
        if hasattr(audio, "detach"):
            audio = audio.detach().cpu().numpy()
        chunks.append(np.asarray(audio).reshape(-1))

    if not chunks:
        raise RuntimeError("Kokoro generated no audio.")

    audio_data = np.concatenate(chunks)

    wav = __import__("io").BytesIO()
    sf.write(wav, audio_data, 24000, format="WAV")

    result = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-i", "pipe:0",
            "-af",
            "highpass=f=140,lowpass=f=6500,"
            "equalizer=f=3000:t=q:w=1:g=3,"
            "acompressor=threshold=0.08:ratio=2:attack=20:release=250,"
            "aecho=0.8:0.7:70:0.18,volume=0.85",
            "-codec:a", "libmp3lame",
            "-q:a", "3",
            "-f", "mp3", "pipe:1"
        ],
        input=wav.getvalue(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True
    )

    return result.stdout

total = 0
completed = 0
failed = []

for story in stories:
    story_id = story["id"]
    chapters = story.get("chapterData") or []

    if not chapters:
        chapters = [{
            "title": "Chapter 1",
            "body": story.get("body") or []
        }]

    for chapter_index, chapter in enumerate(chapters, start=1):
        paragraphs = chapter.get("body") or []

        for paragraph_index, paragraph in enumerate(paragraphs, start=1):
            if not isinstance(paragraph, str) or not paragraph.strip():
                continue

            total += 1

            destination = (
                OUTPUT
                / f"story-{story_id}"
                / f"chapter-{chapter_index}"
                / f"paragraph-{paragraph_index}.mp3"
            )

            if destination.exists() and destination.stat().st_size > 0:
                print(f"[EXISTS] Story {story_id}, chapter {chapter_index}, paragraph {paragraph_index}")
                completed += 1
                continue

            destination.parent.mkdir(parents=True, exist_ok=True)

            print(
                f"[{total}] Generating: {story.get('title', 'Untitled')} "
                f"| Chapter {chapter_index} "
                f"| Paragraph {paragraph_index}",
                flush=True
            )

            try:
                audio_bytes = make_audio(paragraph.strip())

                temporary = destination.with_suffix(".tmp.mp3")
                temporary.write_bytes(audio_bytes)
                temporary.replace(destination)

                completed += 1
                print(f"  Saved: {destination.relative_to(ROOT)}")

            except Exception as exc:
                failed.append((story_id, chapter_index, paragraph_index, str(exc)))
                print(f"  FAILED: {exc}", flush=True)

print("\n========== GENERATION REPORT ==========")
print(f"Paragraphs found: {total}")
print(f"Audio files ready: {completed}")
print(f"Failures: {len(failed)}")

if failed:
    for item in failed:
        print("FAILED:", item)

print("Audio folder:", OUTPUT)
