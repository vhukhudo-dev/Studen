#!/usr/bin/env python3
"""Word-level transcript of a recording with NVIDIA Parakeet (via sherpa-onnx).

  python3 tools/transcribe.py work/clips/take1.wav [more.wav ...] --model DIR

Writes <wav>.words.json next to each input:
  {"duration": s, "text": "...", "words": [{"w": "chair", "start": 10.2, "end": 10.5}, ...]}

Model: sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8 from the k2-fsa/sherpa-onnx
GitHub releases (asr-models). Audio is cut at pauses into <=25 s chunks first.
"""
import argparse
import io
import json
import os
import sys
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MODEL = os.environ.get("PARAKEET_DIR", os.path.join(ROOT, "models", "sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8"))


def load_wav(path):
    with wave.open(path, "rb") as w:
        assert w.getframerate() == 16000 and w.getnchannels() == 1 and w.getsampwidth() == 2, "need 16 kHz mono 16-bit wav"
        raw = w.readframes(w.getnframes())
    return raw, np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def chunks(raw, total, max_len=25.0):
    """Speech spans split at pauses, merged up to max_len seconds."""
    from pocketsphinx import Segmenter
    spans = [(s.start_time, s.end_time) for s in Segmenter(sample_rate=16000).segment(io.BytesIO(raw))]
    out = []
    for a, b in spans:
        a, b = max(0.0, a - 0.25), min(total, b + 0.25)
        if out and b - out[-1][0] <= max_len:
            out[-1] = (out[-1][0], b)
        else:
            out.append((a, b))
    # Long unbroken speech: hard-split.
    res = []
    for a, b in out:
        while b - a > max_len:
            res.append((a, a + max_len)); a += max_len
        res.append((a, b))
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("wavs", nargs="+")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--threads", type=int, default=4)
    a = ap.parse_args()

    import sherpa_onnx
    m = a.model
    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=os.path.join(m, "encoder.int8.onnx"), decoder=os.path.join(m, "decoder.int8.onnx"),
        joiner=os.path.join(m, "joiner.int8.onnx"), tokens=os.path.join(m, "tokens.txt"),
        num_threads=a.threads, model_type="nemo_transducer", decoding_method="greedy_search")

    for path in a.wavs:
        raw, x = load_wav(path)
        total = len(x) / 16000.0
        words = []
        for c0, c1 in chunks(raw, total):
            s = rec.create_stream()
            s.accept_waveform(16000, x[int(c0 * 16000):int(c1 * 16000)])
            rec.decode_stream(s)
            r = s.result
            for tok, ts in zip(r.tokens, r.timestamps):
                t = c0 + ts
                if tok[:1] in (" ", "▁") or not words:
                    words.append({"w": tok.lstrip(" ▁"), "start": round(t, 3), "end": round(t + 0.2, 3)})
                else:
                    words[-1]["w"] += tok
                    words[-1]["end"] = round(t + 0.2, 3)
        words = [w for w in words if w["w"]]
        for w, nxt in zip(words, words[1:]):
            w["end"] = round(min(w["end"], nxt["start"]), 3)
        out = {"duration": round(total, 3), "text": " ".join(w["w"] for w in words), "words": words}
        dst = os.path.splitext(path)[0] + ".words.json"
        with open(dst, "w") as f:
            json.dump(out, f, indent=1)
        print(f"{os.path.basename(path)} ({total:.0f}s, {len(words)} words) -> {dst}", file=sys.stderr)


if __name__ == "__main__":
    main()
