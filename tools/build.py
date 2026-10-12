#!/usr/bin/env python3
"""One command from presenter video(s) to the finished board video.

  python3 tools/build.py --edit script/edit.json      # cut the best bits of several takes (recommended)
  python3 tools/build.py input/presentation.mp4       # one clean take
  python3 tools/build.py input/1.mp4 input/2.mp4      # clips joined in order
  ... --corner left                                   # presenter bottom-left instead of bottom-right

Steps: transcribe the takes word by word (tools/transcribe.py, Parakeet) ->
cut them into one natural take (tools/edit.py, if --edit) -> find when each
sentence and word is said (tools/align.py) -> render the 3D animation with live
captions to those timings (tools/render.mjs) -> put the presenter in a rounded
corner window over the animation. Output: output/final.mp4
"""
import argparse
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, "work")
W, H, MARGIN, RADIUS = 1920, 1080, 40, 28


def run(cmd, **kw):
    print("+", " ".join(str(c) for c in cmd), flush=True)
    subprocess.run(cmd, check=True, **kw)


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height:stream_side_data=rotation:format=duration", "-of", "json", path],
                         check=True, capture_output=True, text=True).stdout
    d = json.loads(out)
    s = d["streams"][0]
    w, h = s["width"], s["height"]
    rot = 0
    for sd in s.get("side_data_list", []):
        rot = int(sd.get("rotation", 0) or 0)
    if abs(rot) % 180 == 90:
        w, h = h, w
    return w, h, float(d["format"]["duration"])


def has_audio(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index",
                          "-of", "csv=p=0", path], capture_output=True, text=True).stdout
    return bool(out.strip())


def join_clips(clips, out):
    """Normalise every clip to the first clip's frame size and join them in order."""
    w, h, _ = probe(clips[0])
    w, h = w - w % 2, h - h % 2
    cmd = ["ffmpeg", "-loglevel", "error", "-y"]
    for c in clips:
        cmd += ["-i", c]
    parts = []
    for i, c in enumerate(clips):
        parts.append(f"[{i}:v]scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v{i}];")
        if has_audio(c):
            parts.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo[a{i}];")
        else:
            d = probe(c)[2]
            parts.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{d}[a{i}];")
    parts.append("".join(f"[v{i}][a{i}]" for i in range(len(clips))) + f"concat=n={len(clips)}:v=1:a=1[v][a]")
    cmd += ["-filter_complex", "".join(parts), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "fast",
            "-crf", "18", "-c:a", "aac", "-b:a", "192k", out]
    run(cmd)


def pip_size(w, h):
    """Fit the presenter inside a corner box: tall for phone video, wide for laptop video."""
    box_w, box_h = (520, 440) if h > w else (500, 300)
    k = min(box_w / w, box_h / h)
    return int(w * k) // 2 * 2, int(h * k) // 2 * 2


def make_overlays(pw, ph):
    """Rounded-corner mask, soft drop shadow and thin border for the presenter window."""
    mask = os.path.join(WORK, "pip_mask.png")
    border = os.path.join(WORK, "pip_border.png")
    shadow = os.path.join(WORK, "pip_shadow.png")
    run(["convert", "-size", f"{pw}x{ph}", "xc:black", "-fill", "white", "-draw",
         f"roundrectangle 0,0,{pw - 1},{ph - 1},{RADIUS},{RADIUS}", mask])
    run(["convert", "-size", f"{pw}x{ph}", "xc:none", "-fill", "none", "-stroke", "rgba(255,255,255,0.55)",
         "-strokewidth", "3", "-draw", f"roundrectangle 1,1,{pw - 2},{ph - 2},{RADIUS},{RADIUS}", border])
    pad = 60
    run(["convert", "-size", f"{pw + 2 * pad}x{ph + 2 * pad}", "xc:none", "-fill", "rgba(0,0,0,0.75)", "-draw",
         f"roundrectangle {pad},{pad},{pw + pad},{ph + pad},{RADIUS},{RADIUS}", "-blur", "0x18", shadow])
    return mask, border, shadow, pad


def compose(anim, presenter, out, corner):
    w, h, dur = probe(presenter)
    pw, ph = pip_size(w, h)
    mask, border, shadow, pad = make_overlays(pw, ph)
    x = W - MARGIN - pw if corner == "right" else MARGIN
    y = H - MARGIN - ph
    fg = (f"[1:v]scale={pw}:{ph}:force_original_aspect_ratio=increase,crop={pw}:{ph},fps=30,format=rgba[p];"
          f"[2:v]format=gray[m];[p][m]alphamerge[pr];"
          f"[0:v][4:v]overlay={x - pad}:{y - pad + 14}[b1];"
          f"[b1][pr]overlay={x}:{y}[b2];"
          f"[b2][3:v]overlay={x}:{y},format=yuv420p[v]")
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", anim, "-i", presenter,
         "-loop", "1", "-i", mask, "-loop", "1", "-i", border, "-loop", "1", "-i", shadow,
         "-filter_complex", fg, "-map", "[v]", "-map", "1:a?", "-t", f"{dur:.3f}",
         "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k",
         "-movflags", "+faststart", out])
    return pw, ph


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("clips", nargs="*", help="presenter video(s), joined in the order given (not needed with --edit)")
    ap.add_argument("--edit", help="edit list (script/edit.json) choosing which words of which take to keep")
    ap.add_argument("--model", default=os.environ.get("PARAKEET_DIR", os.path.join(ROOT, "models", "sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8")),
                    help="Parakeet model folder (tools/get_model.sh); without it, sync falls back to pocketsphinx and there are no live captions")
    ap.add_argument("--corner", choices=["right", "left"], default="right", help="bottom corner for the presenter")
    ap.add_argument("--out", default=os.path.join(ROOT, "output", "final.mp4"))
    ap.add_argument("--workers", type=int, default=3, help="parallel browser renderers")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--skip-align", action="store_true", help="keep script/timings.json as it is (e.g. hand-edited)")
    ap.add_argument("--skip-render", action="store_true", help="reuse work/animation.mp4")
    a = ap.parse_args()

    os.makedirs(WORK, exist_ok=True)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    have_model = os.path.exists(os.path.join(a.model, "tokens.txt"))
    transcribe = lambda wavs: run([sys.executable, os.path.join(ROOT, "tools", "transcribe.py"), *wavs, "--model", a.model])
    words = None

    if a.edit:
        with open(a.edit) as f:
            edl = json.load(f)
        need = []
        for src in edl["clips"].values():
            name = os.path.splitext(os.path.basename(src))[0]
            wav = os.path.join(WORK, "clips", f"{name}.wav")
            os.makedirs(os.path.dirname(wav), exist_ok=True)
            if not os.path.exists(wav):
                run(["ffmpeg", "-loglevel", "error", "-y", "-i", os.path.join(ROOT, src), "-vn", "-ac", "1", "-ar", "16000", "-sample_fmt", "s16", wav])
            if not os.path.exists(os.path.splitext(wav)[0] + ".words.json"):
                need.append(wav)
        if need:
            if not have_model:
                sys.exit("--edit needs word timings: run tools/get_model.sh first")
            transcribe(need)
        presenter = os.path.join(WORK, "presenter.mp4")
        run([sys.executable, os.path.join(ROOT, "tools", "edit.py"), a.edit, "--out", presenter])
        words = os.path.splitext(presenter)[0] + ".words.json"
    else:
        if not a.clips:
            sys.exit("give presenter video(s) or --edit script/edit.json")
        clips = [os.path.abspath(c) for c in a.clips]
        for c in clips:
            if not os.path.exists(c):
                sys.exit(f"not found: {c}")
        presenter = os.path.join(WORK, "presenter.mp4")
        if len(clips) == 1 and clips[0].lower().endswith(".mp4") and has_audio(clips[0]):
            presenter = clips[0]
        else:
            join_clips(clips, presenter)

    voice = os.path.join(WORK, "voice.wav")
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", presenter, "-vn", "-ac", "1", "-ar", "16000", "-sample_fmt", "s16", voice])
    if words is None and have_model and not a.skip_align:
        transcribe([voice])
        words = os.path.splitext(voice)[0] + ".words.json"

    if not a.skip_align:
        how = ["--words", words] if words else ["--audio", voice]
        run([sys.executable, os.path.join(ROOT, "tools", "align.py"), *how])

    anim = os.path.join(WORK, "animation.mp4")
    if not a.skip_render:
        run(["node", os.path.join(ROOT, "tools", "render.mjs"), "--out", anim, "--fps", str(a.fps),
             "--corner", a.corner, "--workers", str(a.workers)])

    pw, ph = compose(anim, presenter, a.out, a.corner)
    print(f"\nDone: {a.out}  (presenter window {pw}x{ph}, bottom-{a.corner})")


if __name__ == "__main__":
    main()
