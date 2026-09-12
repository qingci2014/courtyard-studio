# 素材来源 / Asset credits

本轮实际素材支出：人民币 0 元。未购买或使用搜索结果中的付费模型包。

## Poly Haven：月面材质与扫描岩石

- Moon 01: https://polyhaven.com/a/moon_01
- Moon Rock 06: https://polyhaven.com/a/moon_rock_06
- License: CC0 1.0, https://polyhaven.com/license
- Files: public/moon/textures/moon_*.jpg and public/moon/rock/**
- Download manifests: https://api.polyhaven.com/files/moon_01 and https://api.polyhaven.com/files/moon_rock_06
- Moon 01 contributors: Dario Barresi, Greg Zaal, Jenelle van Heerden, Rico Cilliers.
- The lunar surface material is scanned regolith simulant from a terrestrial lab, not material photographed on the Moon.

## Earth texture

- Three.js official examples: https://github.com/mrdoob/three.js/blob/dev/examples/textures/planets/earth_atmos_2048.jpg
- License: MIT, https://github.com/mrdoob/three.js/blob/dev/LICENSE
- Local file: public/moon/textures/earth.jpg
- Copyright © 2010-2026 three.js authors.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Authored models

The research habitat, living quarters and furnishings, greenhouse and curved foliage, rover, solar arrays, communications equipment, drilling station, service bay, crew lander, cargo and power station are authored in Blender for this project. Source: model-source/moon/build_base.py, its companion Python modules and selene-base.blend. No paid asset was used for these objects.

The field exploration structures and the refined cabin furnishings, display geometry, lighting channels and materials were authored for SELENE in code/Blender. No additional paid assets were purchased for this iteration.

- Gameplay sound effects: original procedural Web Audio synthesis in app/moon-audio.ts. No purchased/downloaded samples and no microphone capture.

- Cockpit background piano: user-supplied `moon2.mp3`, converted to `content/audio/moon2.m4a` for web delivery. This is a separate supplied music asset, not part of the procedural sound effects.

- Indoor companion: original Blender geometry built from the user-provided visual reference; editable source model-source/moon/companion.blend and generator build-companion.py. No downloaded or purchased robot model.

## Field terminal interface — 2026-09-13

- `public/content/ui/terminal-shell-v1.png`: original AI-generated blank graphite-glass terminal surface, based on the approved SELENE concept. It contains no baked-in labels or controls; game text and interactive controls render as accessible HTML.
- `public/content/ui/archive-distant-echo-v1.png`: original AI-generated archive illustration of a derelict lunar probe. This is narrative artwork, not a gameplay screenshot or a historical photograph.
- `public/content/ui/signal-wave.svg`, `hud-reticle.svg`, `eyepiece-reticle.svg`: project-authored vector interface assets. The small radio waveform is decorative; the tuning spectrum and cursor are driven by the current controls.
- These assets were produced for this project using the built-in image generation tool and original SVG code. No paid or third-party stock pack was purchased. The cockpit assets remain unchanged.
- Production generation brief: a frontal, blank dark graphite terminal, thin weathered silver frame, restrained ice-blue edge lighting, readable low-noise glass interior; no letters, buttons, perspective, or baked-in UI. Solid near-black exterior around the frame (no simulated transparency). Archive illustration brief: a damaged unmanned probe on grey lunar regolith, aged dish, gold thermal foil, fractured solar panel, distant Earth, cinematic hard sunlight and deep shadows, no text or overlays.
