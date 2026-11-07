"""Original 16-bar minor-key space/military ambience; no sampled game music."""
from array import array
from pathlib import Path
import math
import random
import wave

RATE = 22050
BEAT = 60 / 104
DURATION = BEAT * 64
mix = array('f', [0]) * round(RATE * DURATION)
rng = random.Random(712)


def tone(start, seconds, frequency, gain, kind='pad'):
    count = round(seconds * RATE)
    offset = round(start * RATE)
    phase = rng.random() * math.tau
    for i in range(min(count, len(mix) - offset)):
        t = i / RATE
        end = max(0, 1 - i / count)
        if kind == 'pad':
            envelope = min(1, t / 0.5) * min(1, end * seconds / 0.8)
            value = math.sin(math.tau * frequency * t + phase) + 0.18 * math.sin(math.tau * frequency * 2.003 * t)
        elif kind == 'kick':
            envelope = math.exp(-t * 18)
            value = math.sin(math.tau * (48*t + 3*(1-math.exp(-t*24))))
        elif kind == 'hat':
            envelope = math.exp(-t*60)
            value = rng.uniform(-1, 1)
        else:
            envelope = min(1, t / 0.015) * math.exp(-t * 4)
            value = math.sin(math.tau * frequency * t) + 0.12 * math.sin(math.tau * frequency * 3 * t)
        mix[offset + i] += value * gain * envelope


chords = [(110, 130.81, 164.81), (87.31, 110, 130.81), (130.81, 164.81, 196), (98, 123.47, 146.83)]
for bar in range(16):
    start = bar * BEAT * 4
    chord = chords[(bar // 2) % 4]
    for freq in chord:
        tone(start, BEAT * 4, freq, 0.12)
    tone(start, BEAT * 3.9, chord[0] / 2, 0.17)
    for beat in range(4):
        tone(start + beat * BEAT, 0.28, 48, 0.18 if beat in (0, 2) else 0.07, 'kick')
        if bar % 4 != 3:
            tone(start + (beat + 0.5) * BEAT, 0.10, 0, 0.035, 'hat')
        note = chord[(beat + bar) % 3] * (2 if bar % 4 < 2 else 4)
        tone(start + beat * BEAT, BEAT * 1.6, note, 0.055, 'pluck')

peak = max(abs(v) for v in mix)
pcm = array('h')
for i, value in enumerate(mix):
    edge = min(1, i / (RATE * 0.2), (len(mix) - i) / (RATE * 0.35))
    pcm.append(round(value / peak * 24500 * edge))
destination = Path(__file__).resolve().parent.parent / 'public/audio/music/terran-orbit.wav'
destination.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(destination), 'wb') as out:
    out.setnchannels(1)
    out.setsampwidth(2)
    out.setframerate(RATE)
    out.writeframes(pcm.tobytes())
print(f'{destination}: {DURATION:.2f}s, {destination.stat().st_size} bytes')
