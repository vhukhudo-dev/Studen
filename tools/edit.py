#!/usr/bin/env python3
"""Cut the presenter's takes into one clean, natural-flowing video.

  python3 tools/edit.py script/edit.json            # -> work/presenter.mp4 + work/presenter.words.json

script/edit.json lists which words of which take to keep, in order:
  {"clips": {"A": "input/raw/take1.mp4", ...},
   "keep": [["A", 0, 76], ["B", 0, 80], ["B", 82, 83], ...],   # [clip, first word, last word] (inclusive)
   "drop": {"D": [[114.6, 115.4]]},                              # optional: seconds to cut inside a take
   "max_pause": 0.8,
   "tail": 3.0}                                                   # seconds to hold the last frame

Word indices refer to work/clips/<name>.words.json from tools/transcribe.py.
Cuts are placed in the quiet just before/after the chosen words, pauses longer
than max_pause seconds inside a kept stretch are shortened, and each piece gets
a few milliseconds of audio fade so joins don't click. The kept words are
re-timed onto the edited video so captions and animation can follow them.
"""
import argparse
import json
import os
import subprocess
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, "work")
HOP = 0.01  # energy frame (s)


def clip_wav(src, name):
    os.makedirs(os.path.join(WORK, "clips"), exist_ok=True)
    wav = os.path.join(WORK, "clips", f"{name}.wav")
    if not os.path.exists(wav):
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000",
                        "-sample_fmt", "s16", wav], check=True)
    return wav


def energy_db(wav):
    with wave.open(wav, "rb") as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    f = int(16000 * HOP)
    m = len(x) // f
    db = 20 * np.log10(np.sqrt((x[:m * f].reshape(m, f) ** 2).mean(1) + 1e-10))
    thr = min(-36.0, float(np.percentile(db, 30)) + 6.0)
    return db, thr, len(x) / 16000.0


def quiet(db, thr, t):
    i = int(t / HOP)
    return 0 <= i < len(db) and db[i] < thr


def quiet_run(db, thr, t_end, n):
    """True if the n frames ending at t_end are all quiet."""
    return all(quiet(db, thr, t_end - k * HOP) for k in range(n))


def softest(db, a, b):
    """Time of the lowest-energy frame in [a, b] (the join between run-on words)."""
    i0, i1 = max(0, int(a / HOP)), min(len(db) - 1, int(b / HOP))
    return (i0 + int(np.argmin(db[i0:i1 + 1]))) * HOP if i1 > i0 else a


def cut_before(db, thr, t_word, t_floor):
    """Cut inside the last real pause (>=120 ms) before a word, not in the
    brief silence of a stop consonant; with no pause, at the softest instant."""
    t = t_word + 0.05  # token timestamps can run slightly late
    while t > t_floor + 0.12:
        if quiet_run(db, thr, t, 12):
            return t - 0.03
        t -= HOP
    return softest(db, t_floor, t_word)


def cut_after(db, thr, t_last_start, t_ceil):
    """Cut a little into the first real pause (>=150 ms) after the last kept word."""
    t = t_last_start + 0.2
    while t < t_ceil:
        if quiet_run(db, thr, t + 0.15, 15):
            return min(t_ceil, t + 0.1)
        t += HOP
    return softest(db, t_last_start + 0.2, t_ceil)


def tighten(db, thr, a, b, max_pause, word_starts):
    """Split [a, b] around silences longer than max_pause, keeping a short gap.
    A "silence" with a recognised word inside it is quiet speech, never cut."""
    keep = max_pause * 0.6
    pieces, start = [], a
    i, i_end = int(a / HOP), int(b / HOP)
    run_start = None
    while i <= i_end:
        q = i < len(db) and db[i] < thr
        if q and run_start is None:
            run_start = i
        if (not q or i == i_end) and run_start is not None:
            s0, s1 = run_start * HOP, i * HOP
            spoken = any(s0 + 0.15 < w < s1 - 0.15 for w in word_starts)
            if s1 - s0 > max_pause and s0 > a + 0.05 and s1 < b - 0.05 and not spoken:
                pieces.append((start, s0 + keep / 2))
                start = s1 - keep / 2
            run_start = None
        i += 1
    pieces.append((start, b))
    return [(x, y) for x, y in pieces if y - x > 0.05]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("edl", nargs="?", default=os.path.join(ROOT, "script", "edit.json"))
    ap.add_argument("--out", default=os.path.join(WORK, "presenter.mp4"))
    a = ap.parse_args()
    with open(a.edl) as f:
        edl = json.load(f)
    max_pause = edl.get("max_pause", 0.8)

    info = {}
    for key, src in edl["clips"].items():
        src = os.path.join(ROOT, src)
        name = os.path.splitext(os.path.basename(src))[0]
        wav = clip_wav(src, name)
        with open(os.path.splitext(wav)[0] + ".words.json") as f:
            words = json.load(f)["words"]
        db, thr, dur = energy_db(wav)
        info[key] = dict(src=src, words=words, db=db, thr=thr, dur=dur)

    pieces = []  # (clip key, t0, t1)
    for key, w0, w1 in edl["keep"]:
        c = info[key]
        ws = c["words"]
        floor = ws[w0 - 1]["start"] + 0.12 if w0 > 0 else 0.0
        ceil = ws[w1 + 1]["start"] - 0.02 if w1 + 1 < len(ws) else c["dur"]
        t0 = cut_before(c["db"], c["thr"], ws[w0]["start"], floor)
        t1 = cut_after(c["db"], c["thr"], ws[w1]["start"], ceil)
        starts = [w["start"] for w in ws[w0:w1 + 1]]
        for x, y in tighten(c["db"], c["thr"], t0, t1, max_pause, starts):
            # Remove any hand-marked stumbles (seconds in the take) inside this stretch.
            for d0, d1 in sorted(edl.get("drop", {}).get(key, [])):
                if x < d0 < y:
                    pieces.append((key, x, d0)); x = max(x, d1)
                elif x < d1 < y:
                    x = d1
            if y - x > 0.05:
                pieces.append((key, x, y))
    # Snap cuts to the 30 fps frame grid so every piece's video and audio are the
    # same length (otherwise concat pads audio and the timeline slowly drifts).
    pieces = [(k, round(x * 30) / 30, round(y * 30) / 30) for k, x, y in pieces]
    pieces = [(k, x, y) for k, x, y in pieces if y > x]

    # Re-time the kept words onto the edited timeline.
    # (A token timestamp can land a hair before the cut, so allow a little slack.)
    kept = {(key, i) for key, w0, w1 in edl["keep"] for i in range(w0, w1 + 1)}
    out_words, off, seen = [], 0.0, set()
    for key, x, y in pieces:
        for i, w in enumerate(info[key]["words"]):
            if x - 0.15 <= w["start"] < y and (key, i) in kept and (key, i) not in seen:
                seen.add((key, i))
                out_words.append({"w": w["w"], "start": round(off + max(0.0, w["start"] - x), 3),
                                  "end": round(off + min(w["end"], y) - x, 3), "src": key})
        off += y - x
    total = off
    expected = sum(w1 - w0 + 1 for _, w0, w1 in edl["keep"])
    if len(out_words) != expected:
        print(f"warning: {expected - len(out_words)} kept word(s) fell outside the cut pieces")

    # Build the edited video: trim each piece, micro-fade the audio, concatenate.
    keys = list(info)
    cmd = ["ffmpeg", "-loglevel", "error", "-y"]
    for k in keys:
        cmd += ["-i", info[k]["src"]]
    fg = []
    for i, (k, x, y) in enumerate(pieces):
        j = keys.index(k)
        d = y - x
        fg.append(f"[{j}:v]trim=start={x:.3f}:end={y:.3f},setpts=PTS-STARTPTS,fps=30,format=yuv420p[v{i}];")
        fg.append(f"[{j}:a]atrim=start={x:.3f}:end={y:.3f},asetpts=PTS-STARTPTS,aresample=48000,"
                  f"afade=t=in:d=0.012,afade=t=out:st={max(0, d - 0.015):.3f}:d=0.015[a{i}];")
    # Hold the last frame (in silence) for a moment so the closing card can land.
    tail = edl.get("tail", 0.0)
    fg.append("".join(f"[v{i}][a{i}]" for i in range(len(pieces))) + f"concat=n={len(pieces)}:v=1:a=1[vc][ac];"
              f"[vc]tpad=stop_mode=clone:stop_duration={tail}[v];[ac]apad=pad_dur={tail}[a]")
    total += tail
    script = os.path.join(WORK, "edit_filter.txt")
    with open(script, "w") as f:
        f.write("".join(fg))
    cmd += ["-filter_complex_script", script, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "fast",
            "-crf", "18", "-c:a", "aac", "-b:a", "192k", a.out]
    subprocess.run(cmd, check=True)

    words_out = os.path.splitext(a.out)[0] + ".words.json"
    with open(words_out, "w") as f:
        json.dump({"duration": round(total, 3), "text": " ".join(w["w"] for w in out_words), "words": out_words,
                   "pieces": [[k, round(x, 3), round(y, 3)] for k, x, y in pieces]}, f, indent=1)
    raw = sum(info[k]["dur"] for k in info)
    print(f"{len(pieces)} pieces -> {a.out} ({total:.1f}s from {raw:.1f}s of takes); words -> {words_out}")


if __name__ == "__main__":
    main()
