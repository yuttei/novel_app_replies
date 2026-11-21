#!/usr/bin/env bash

# DOVA-SYNDROMEから入手した元BGMを、Webゲームで配信するMP3へ変換します。
# 元ファイルはBGMフォルダに残し、staticフォルダの公開用ファイルだけを上書きします。

set -euo pipefail

# どのディレクトリから実行しても、プロジェクトのルートで処理します。
project_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_root"

convert_bgm() {
  local source_file="$1"
  local public_file="$2"

  printf '公開用BGMを作成します: %s\n' "$public_file"
  ffmpeg \
    -hide_banner \
    -loglevel warning \
    -y \
    -i "$source_file" \
    -map 0:a:0 \
    -vn \
    -map_metadata -1 \
    -codec:a libmp3lame \
    -q:a 2 \
    "$public_file"
}

convert_bgm "BGM/私は口を閉ざす.mp3" "static/audio/bgm/title.mp3"
convert_bgm "BGM/朝日溢れる回廊_2.mp3" "static/audio/bgm/corridor.mp3"
convert_bgm "BGM/悠久の大地.mp3" "static/audio/bgm/eternal-earth.mp3"
convert_bgm "BGM/星の名残り.mp3" "static/audio/bgm/star-remnants.mp3"

printf '4曲の公開用BGMを作成しました。\n'
