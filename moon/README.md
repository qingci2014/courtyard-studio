# Lunar sub-application

The existing robot homepage stays at `/`. The independent React lunar application is in `moon/`, deployed at `/moon/`. Its cockpit entry is `/moon/cockpit/`.

`npm ci` and `npm run build` build the original homepage first, then append the lunar application under `dist/moon/`. No Sites credentials or hosting configuration are included. Lunar assets are under `/moon/content/`; the server-only EdgeOne handler is `/moon/api/command`.

The optional model remains unconfigured by default. EdgeOne environment variables: WORKSHOP_MODEL_ENABLED, WORKSHOP_MODEL_KEY (secret), WORKSHOP_MODEL_BASE_URL, WORKSHOP_MODEL. Local gameplay does not need this API.

`npm test` verifies the original robot application. `node scripts/verify-moon-deployment.mjs` verifies deployment entries after building. The cockpit is a visual study, not yet free-flight gameplay. Previous Sites source and editable Blender files remain in the independent selene-lunar workspace.

Cockpit delivery preserves all geometry and instrument/legend images. Large
surface maps use WebP (lossless roughness; near-lossless normal maps, at most
1/255 channel error). The build generates `cockpit-packed.bin` and a content
version manifest. The browser decompresses it natively, reports download
progress, and falls back to `cockpit.glb` when needed. Window textures have
separate exports so the base game's close-up terrain is unaffected; all cockpit
assets download in parallel. The model transfer is 8,136,387 bytes and the
window textures total 2,163,054 bytes for this revision (previous combined
assets: 27,223,088 bytes). Editable source and the texture optimizer are in the
`selene-lunar` authoring workspace.

Cockpit music uses the user-supplied `moon2` track, encoded as stereo AAC at
96 kbps in a fast-start M4A (2,486,200 bytes, 203.173 seconds). The original
MP3 is retained outside the public bundle. Re-encode with
`ffmpeg -i moon2.mp3 -map 0:a:0 -vn -c:a aac -b:a 96k -movflags +faststart -map_metadata -1 moon2.m4a`.
The audio element receives no source until the cockpit has rendered. Each visit
defaults to playback, remembers only volume, loops the track, and pauses when
hidden or leaving the cockpit. Browsers that block audible autoplay resume on
the first cockpit interaction or the play button. The controls are CSS/SVG
hardware-style keys; no interface bitmap assets are loaded.
