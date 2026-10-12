# Sixty60 Board presentation video

This repo turns recordings of you giving the Audit & Risk Committee talk into a finished video:

- **Full screen:** 3D animations, one for each idea in the talk (+300% surge, Stage 6 load-shedding, the SAM grid, recovery targets, warm standby, the monitoring signals, the request to the Board…).
- **Your words on screen:** a live caption under each headline. Every word pops in as you say it, and the current word is highlighted.
- **Bottom corner:** you, in a rounded window, like a WhatsApp video call.
- **Timing:** each animation starts when *you* say those words, using word-level timestamps from speech recognition.
- **Clean edit:** several takes are cut into one natural take. Repeats, false starts, stumbles and long pauses are removed.

## How to use it

```bash
npm install                     # three.js (first time only)
tools/get_model.sh              # speech recogniser, ~480 MB (first time only)

# Several takes -> one clean edit (what was used for the current video):
python3 tools/build.py --edit script/edit.json

# Or a single clean take / clips joined in order:
python3 tools/build.py input/presentation.mp4
python3 tools/build.py input/*.mp4 --corner left   # presenter bottom-left
```

The result is `output/final.mp4` (1920×1080, 30 fps, your audio). A 6-minute talk takes about an hour to render on 4 CPU cores.

### Making an edit from several takes

1. Put the takes in `input/raw/` and transcribe them:
   `python3 tools/transcribe.py work/clips/*.wav` (the build makes the wavs). This writes `work/clips/<take>.words.json` with every word and its time.
2. In `script/edit.json`, list which words of which take to keep, in order, as `[take, first word, last word]`. Leave out repeats and stumbles. `"drop"` removes exact seconds inside a take (for a stutter the recogniser didn't write down). `"max_pause"` shortens long pauses, and `"tail"` holds the last frame at the end.
3. `python3 tools/build.py --edit script/edit.json`

`tools/edit.py` places every cut in a real pause, never inside a word (it avoids the short silences inside consonants like "k"). It never trims a quiet word, snaps cuts to video frames so sound and picture stay in sync, and re-times every kept word onto the edited video.

## How it works

| Step | File | What it does |
| --- | --- | --- |
| Script | `script/beats.json` | The talk split into 37 "beats" (sentences), worded the way you said them. Each beat has a headline, a 3D scene, and optional *cue* phrases that bring in parts of a scene on specific words (e.g. each monitoring tile appears as you name it). |
| Transcribe | `tools/transcribe.py` | NVIDIA Parakeet (sherpa-onnx), offline. Word-level timestamps. |
| Edit | `tools/edit.py` + `script/edit.json` | Cuts the takes into one video, `work/presenter.mp4`, plus its word timings. |
| Sync | `tools/align.py` | Matches the transcript to the beats. Writes `script/timings.json`: when each beat and cue starts, plus every caption word's time. Without the model it falls back to pocketsphinx (beat timing only, no live captions). |
| Animation | `animation/` | three.js (`scenes.js`: 25 scenes; `kit.js`: shared 3D parts; `scene.js`: timeline, camera, captions). Deterministic: `renderAt(t)` draws the exact frame for time `t`. |
| Render | `tools/render.mjs` | Steps headless Chromium frame by frame, with parallel workers, into `work/animation.mp4`. |
| Compose | `tools/build.py` | Runs the steps above, then overlays you bottom-right (or left) with rounded corners, a border and a shadow. |

## Fixing timing by hand

`script/timings.json` is written by the sync step and isn't kept in git. To nudge a visual, edit that beat's `start` (seconds), then rebuild without re-running the sync:

```bash
python3 tools/build.py work/presenter.mp4 --skip-align
```

## Previewing without rendering

```bash
npx serve .          # then open http://localhost:3000/animation/index.html?live&pip
```

`?t=60` jumps to 60 s. `?audio=../work/voice.wav&live` plays in sync with your voice (click the page to start). Quick stills: `node tools/render.mjs --stills 5,30,61.5 --pip` writes PNGs to `work/stills/`.
