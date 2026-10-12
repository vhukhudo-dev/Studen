#!/usr/bin/env bash
# Download the speech recogniser used for word timings and live captions:
# NVIDIA Parakeet TDT 0.6B v2 (int8, via sherpa-onnx), ~480 MB, into models/.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p models
pip install --quiet sherpa-onnx pocketsphinx numpy
NAME=sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8
if [ ! -f "models/$NAME/tokens.txt" ]; then
  curl -fL --retry 3 -o "models/$NAME.tar.bz2" \
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/$NAME.tar.bz2"
  tar xjf "models/$NAME.tar.bz2" -C models && rm "models/$NAME.tar.bz2"
fi
echo "model ready: models/$NAME"
