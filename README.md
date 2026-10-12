# Sixty60 Board presentation video

This repo turns a recording of you giving the Audit & Risk Committee speech into a finished video:

- **Full screen:** 3D animations, one for each idea in the speech (+300% surge, Stage 6 load-shedding, the SAM grid, RTO/RPO bars, warm standby, the KPI triggers, sign-off…).
- **Bottom corner:** your video in a rounded window, like a WhatsApp video call.
- **Timing:** each animation starts when *you* say those words. The tool listens to your recording and finds when each sentence starts, so pauses, speed changes and small ad-libs are fine.

## How to use it

1. Put your recording(s) in `input/`. You can use one video of the whole speech, or one clip per slide named so they sort in order (`1.mp4`, `2.mp4`, `3.mp4`, `4.mp4`).
2. Run:

   ```bash
   npm install                      # three.js (first time only)
   pip install pocketsphinx         # speech recogniser (first time only)
   python3 tools/build.py input/*.mp4               # presenter bottom-right
   python3 tools/build.py input/*.mp4 --corner left # presenter bottom-left
   ```

3. The result is `output/final.mp4` (1920×1080, 30 fps, your audio).

A 3-minute speech takes about 25–30 minutes to render on 4 CPU cores.

## How it works

| Step | File | What it does |
| --- | --- | --- |
| Script | `script/beats.json` | The speech split into 35 "beats" (sentences). Each beat has an on-screen headline, a 3D scene, and optional *cue* phrases. Cues make parts of a scene appear on specific words, e.g. each of the five KPI tiles appears as you name it. |
| Sync | `tools/align.py` | Runs offline speech recognition (pocketsphinx) with a language model built from the script, matches what it hears back to the script, and snaps each beat to the moment you start speaking after a pause. Writes `script/timings.json`. On a test recording it placed sentence starts within 0.02 s typically, 0.6 s worst case. |
| Animation | `animation/` | A three.js scene (`scenes.js`: 24 scenes; `kit.js`: shared 3D parts). It is deterministic: `renderAt(t)` draws the exact frame for time `t`. |
| Render | `tools/render.mjs` | Steps headless Chromium frame by frame, using several workers in parallel, and encodes `work/animation.mp4`. |
| Compose | `tools/build.py` | Joins your clips, extracts the voice, runs the sync and the render, then overlays your video bottom-right (or left) with rounded corners, a border and a shadow. |

## Fixing timing by hand

If a visual lands too early or late, edit the `start` (seconds) of that beat in `script/timings.json`. Then rebuild without re-running the sync:

```bash
python3 tools/build.py input/*.mp4 --skip-align
```

## Previewing without rendering

```bash
npx serve .          # then open http://localhost:3000/animation/index.html?live&pip
```

`?t=60` jumps to 60 s. `?audio=../work/voice.wav&live` plays in sync with your voice (click the page to start).

Quick stills: `node tools/render.mjs --stills 5,30,61.5 --pip` writes PNGs to `work/stills/`.

## Changing the words on screen

The headline and sub-line for each beat are in `script/beats.json`. If you change what you *say*, also update that beat's `text` so the sync can follow you.
