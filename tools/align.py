#!/usr/bin/env python3
"""Find when each beat of the speech is spoken and write script/timings.json.

Usage:
  python3 tools/align.py --audio work/voice.wav            # align to real speech
  python3 tools/align.py --estimate --duration 180         # no audio: estimate from word counts

The speech text comes from script/beats.json. We run pocketsphinx speech
recognition with a language model built from the script itself (so it strongly
expects these words), then fuzzy-match the recognised words back to the script.
That tolerates ad-libs, skipped words and pauses; any words it cannot find get
interpolated times from their neighbours.
"""
import argparse
import difflib
import json
import os
import re
import subprocess
import sys
import wave

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BEATS = os.path.join(ROOT, "script", "beats.json")
OUT = os.path.join(ROOT, "script", "timings.json")

# Spoken forms for things the dictionary does not know.
REWRITE = {
    "sixty60": "sixty sixty",
    "popia": "popia",
    "s19": "section nineteen",
}
# ARPABET pronunciations for out-of-dictionary words.
EXTRA_DICT = {
    "popia": "P OW P IY AH",
    "pingo": "P IH NG G OW",
    "pingo's": "P IH NG G OW Z",
    "isizulu": "IY S IY Z UW L UW",
    "fulfilment": "F UH L F IH L M AH N T",
    "rpo": "AA R P IY OW",
    "unvetted": "AH N V EH T IH D",
    "onboarding": "AA N B AO R D IH NG",
}


ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def num_words(n):
    """Spoken form of a number as people say it here: 6060 -> sixty sixty, 300 -> three hundred."""
    if len(n) == 4 and not n.endswith("00"):
        return num_words(n[:2]) + " " + num_words(n[2:].lstrip("0") or "0")
    v = int(n)
    if v < 20:
        return ONES[v]
    if v < 100:
        return TENS[v // 10] + ("" if v % 10 == 0 else " " + ONES[v % 10])
    if v < 1000:
        rest = v % 100
        return ONES[v // 100] + " hundred" + ("" if rest == 0 else " " + num_words(str(rest)))
    return " ".join(ONES[int(c)] for c in n)


def words_of(text):
    t = text.lower().replace("’", "'").replace("—", " ").replace("–", " ")
    t = re.sub(r"[-/]", " ", t)
    t = re.sub(r"[^a-z0-9' ]", " ", t)
    out = []
    for w in t.split():
        w = w.strip("'") if not w.endswith("s'") else w
        if not w:
            continue
        w = REWRITE.get(w, w)
        out.extend(num_words(w).split() if w.isdigit() else w.split())
    return out


def load_beats():
    with open(BEATS) as f:
        return json.load(f)


def flatten(beats):
    """All words in order, plus each beat's (and cue's) starting word index."""
    words, starts, cues = [], [], []
    for b in beats:
        bw = words_of(b["text"])
        starts.append(len(words))
        bc = []
        for c in b.get("cues", []):
            cw = words_of(c)
            idx = find_sub(bw, cw)
            bc.append(len(words) + (idx if idx >= 0 else 0))
        cues.append(bc)
        words.extend(bw)
    return words, starts, cues


def find_sub(hay, needle):
    for i in range(len(hay) - len(needle) + 1):
        if hay[i:i + len(needle)] == needle:
            return i
    return -1


def estimate(data, duration, lead=0.5):
    """Spread beats over the duration in proportion to word count."""
    words, starts, cues = flatten(data["beats"])
    n = len(words)
    per = (duration - lead - 1.0) / n
    wt = [lead + i * per for i in range(n + 1)]
    return wt, starts, cues


def wav_samples(path):
    with wave.open(path, "rb") as w:
        assert w.getframerate() == 16000 and w.getnchannels() == 1 and w.getsampwidth() == 2, \
            "need 16 kHz mono 16-bit wav (tools/build.py makes one)"
        return w.readframes(w.getnframes()), w.getnframes() / 16000.0


def make_decoder(**kw):
    from pocketsphinx import Decoder
    d = Decoder(loglevel="ERROR", **kw)
    for w, ph in EXTRA_DICT.items():
        if d.lookup_word(w) is None:
            d.add_word(w, ph, False)
    return d


def ensure_words(d, words):
    """Add a crude letter-to-sound guess for any remaining unknown word."""
    letters = {"a": "AE", "b": "B", "c": "K", "d": "D", "e": "EH", "f": "F", "g": "G", "h": "HH",
               "i": "IH", "j": "JH", "k": "K", "l": "L", "m": "M", "n": "N", "o": "AA", "p": "P",
               "q": "K", "r": "R", "s": "S", "t": "T", "u": "AH", "v": "V", "w": "W", "x": "K S",
               "y": "Y", "z": "Z", "0": "Z IY R OW", "1": "W AH N", "2": "T UW", "3": "TH R IY",
               "4": "F AO R", "5": "F AY V", "6": "S IH K S", "7": "S EH V AH N", "8": "EY T",
               "9": "N AY N"}
    for w in set(words):
        if d.lookup_word(w) is None:
            ph = " ".join(letters[c] for c in w if c in letters)
            print(f"  [dict] guessing '{w}' -> {ph}", file=sys.stderr)
            d.add_word(w, ph, False)


def script_lm(words_by_sentence, path):
    """Trigram language model built from the script itself, so recognition
    strongly prefers the words the speaker is expected to say."""
    from pocketsphinx.lm import ArpaBoLM
    lm = ArpaBoLM(text="\n".join(" ".join(w) for w in words_by_sentence), discount_mass=0.3, add_start=True)
    lm.compute()
    with open(path, "w") as f:
        lm.write(f)


def recognise(audio, sentences):
    """Recognition biased to the script.

    Returns (words, onsets): recognised (word, start_seconds) pairs, and the
    times where speech resumes after a pause (likely sentence starts)."""
    from pocketsphinx import Segmenter
    lm_path = os.path.join(ROOT, "work", "script.lm")
    os.makedirs(os.path.dirname(lm_path), exist_ok=True)
    script_lm(sentences, lm_path)
    d = make_decoder(lm=lm_path)
    ensure_words(d, [w for s in sentences for w in s])
    out = []
    # Split on pauses so each utterance is a natural phrase.
    seg = Segmenter(sample_rate=16000)
    import io
    spans = [(s.start_time, s.end_time) for s in seg.segment(io.BytesIO(audio))]
    # merge tiny gaps, then cap length ~25 s
    merged = []
    for a, b in spans:
        if merged and (a - merged[-1][1] < 0.3 or b - merged[-1][0] < 3):
            if b - merged[-1][0] < 25:
                merged[-1] = (merged[-1][0], b)
                continue
        merged.append((a, b))
    for a, b in merged:
        a0, b0 = max(0, a - 0.2), b + 0.2
        chunk = audio[int(a0 * 16000) * 2:int(b0 * 16000) * 2]
        d.start_utt()
        d.process_raw(chunk, full_utt=True)
        d.end_utt()
        for s in d.seg():
            w = re.sub(r"\(\d+\)$", "", s.word)
            if w.startswith("<") or w.startswith("["):
                continue
            out.append((w, a0 + s.start_frame / 100.0))
    return out, [a for a, _ in spans]


def fuzzy_align(audio, words, sentences):
    hyp, onsets = recognise(audio, sentences)
    hw = [w for w, _ in hyp]
    sm = difflib.SequenceMatcher(a=words, b=hw, autojunk=False)
    times = [None] * len(words)
    for a, b, n in sm.get_matching_blocks():
        # A lone short word ("and", "the") is too easy to match by accident.
        if n == 1 and len(words[a]) < 4:
            continue
        for i in range(n):
            times[a + i] = hyp[b + i][1]
    return times, onsets


def snap_starts(times, wt, starts, onsets, n_words):
    """Beat start times. Use the recognised time of a beat's first word when we
    have it; otherwise back off from the first word we did recognise and snap to
    the nearest place where speech resumed after a pause."""
    out = []
    for i, s in enumerate(starts):
        e = starts[i + 1] if i + 1 < len(starts) else n_words
        if times[s] is not None:
            out.append(times[s])
            continue
        prev = max((j for j in range(s) if times[j] is not None), default=None)
        lo = times[prev] + 0.15 if prev is not None else 0.0
        k = next((j for j in range(s, e) if times[j] is not None), None)
        if k is not None:
            # local speaking rate from the surrounding recognised words
            rate = (times[k] - lo) / max(1, k - (prev if prev is not None else 0)) if prev is not None else 0.35
            rate = min(max(rate, 0.2), 0.6)
            est, hi = times[k] - (k - s) * rate, times[k]
        else:
            est, hi = wt[s], wt[e]
        cands = [o for o in onsets if lo < o <= hi + 0.05]
        out.append(min(cands, key=lambda o: abs(o - est)) if cands else max(lo, est))
    for i in range(1, len(out)):
        out[i] = max(out[i], out[i - 1] + 0.5)
    return out


def from_transcript(path, words):
    """Per-script-word times from a word-level transcript (tools/transcribe.py or
    tools/edit.py output), plus the times where speech resumes after a pause."""
    with open(path) as f:
        tr = json.load(f)
    toks, ttimes = [], []
    for w in tr["words"]:
        parts = words_of(w["w"])
        span = max(0.05, w["end"] - w["start"])
        for k, p in enumerate(parts):
            toks.append(p)
            ttimes.append(w["start"] + span * k / len(parts))
    sm = difflib.SequenceMatcher(a=words, b=toks, autojunk=False)
    times = [None] * len(words)
    for a, b, n in sm.get_matching_blocks():
        if n == 1 and len(words[a]) < 4:
            continue
        for i in range(n):
            times[a + i] = ttimes[b + i]
    ws = tr["words"]
    onsets = [ws[0]["start"]] + [w["start"] for p, w in zip(ws, ws[1:]) if w["start"] - p["end"] >= 0.25]
    return times, onsets, tr["duration"]


def caption_words(data, wt):
    """Every displayed word of every beat with the time it is spoken."""
    out, k = [], 0
    for bi, b in enumerate(data["beats"]):
        for disp in b["text"].split():
            n = len(words_of(disp))
            if n == 0:
                continue
            out.append({"w": disp, "t": round(wt[k], 3), "b": bi})
            k += n
    return out


def fill_gaps(times, total):
    """Interpolate missing word times so every beat gets a start."""
    n = len(times)
    known = [(i, t) for i, t in enumerate(times) if t is not None]
    if not known:
        return None
    # enforce monotonic
    clean, last = [], -1.0
    for i, t in known:
        if t >= last:
            clean.append((i, t))
            last = t
    known = clean
    if known[0][0] != 0:
        known.insert(0, (0, min(known[0][1], 0.5)))
    if known[-1][0] != n:
        known.append((n, total))
    out = [0.0] * (n + 1)
    for (i0, t0), (i1, t1) in zip(known, known[1:]):
        for i in range(i0, i1 + 1):
            out[i] = t0 + (t1 - t0) * (i - i0) / max(1, i1 - i0)
    return out


def write(data, beat_starts, cue_times, duration, method, coverage=None, captions=None):
    beats = []
    for b, st, cs in zip(data["beats"], beat_starts, cue_times):
        # Land a touch early so the visual is already moving when the words arrive.
        beats.append({"id": b["id"], "start": max(0.0, round(st - 0.25, 3)),
                      "cues": [max(0.0, round(c - 0.15, 3)) for c in cs]})
    beats[0]["start"] = 0.0
    out = {"method": method, "duration": round(duration, 3), "beats": beats}
    if coverage is not None:
        out["coverage"] = round(coverage, 3)
    if captions:
        out["words"] = captions
    with open(OUT, "w") as f:
        json.dump(out, f, indent=1)
    print(f"wrote {OUT} ({method}, {len(beats)} beats, {duration:.1f}s)")
    for b, d in zip(beats, data["beats"]):
        print(f"  {b['start']:7.2f}s  {b['id']}  {d['text'][:60]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--words", help="word-level transcript JSON (preferred: accurate timings + captions)")
    ap.add_argument("--audio", help="16 kHz mono wav of the speech (pocketsphinx fallback)")
    ap.add_argument("--estimate", action="store_true", help="no audio: estimate timings")
    ap.add_argument("--duration", type=float, default=180.0)
    a = ap.parse_args()

    data = load_beats()
    words, starts, cues = flatten(data["beats"])

    if a.words:
        times, onsets, total = from_transcript(a.words, words)
        cov = sum(t is not None for t in times) / len(words)
        print(f"matched {cov:.0%} of script words in the transcript", file=sys.stderr)
        wt = fill_gaps(times, total)
        beat_starts = snap_starts(times, wt, starts, onsets, len(words))
        cue_times = [[max(bs, times[c] if times[c] is not None else wt[c]) for c in cs]
                     for bs, cs in zip(beat_starts, cues)]
        write(data, beat_starts, cue_times, total, "transcript", cov, caption_words(data, wt))
        return

    if a.estimate or not a.audio:
        wt, starts, cues = estimate(data, a.duration)
        write(data, [wt[s] for s in starts], [[wt[c] for c in cs] for cs in cues], a.duration, "estimate")
        return

    audio, total = wav_samples(a.audio)
    sentences = [words_of(b["text"]) for b in data["beats"]]
    times, onsets = fuzzy_align(audio, words, sentences)
    cov = sum(t is not None for t in times) / len(words)
    print(f"matched {cov:.0%} of script words in the audio", file=sys.stderr)
    wt = fill_gaps(times, total)
    if wt is None or cov < 0.15:
        print("could not follow the script in this audio; falling back to an estimate", file=sys.stderr)
        wt, starts, cues = estimate(data, total)
        write(data, [wt[s] for s in starts], [[wt[c] for c in cs] for cs in cues], total, "estimate", cov)
        return
    beat_starts = snap_starts(times, wt, starts, onsets, len(words))
    # Cues: recognised time if available, else interpolated; never before their beat.
    cue_times = [[max(bs, times[c] if times[c] is not None else wt[c]) for c in cs]
                 for bs, cs in zip(beat_starts, cues)]
    write(data, beat_starts, cue_times, total, "recognition", cov)

if __name__ == "__main__":
    main()
