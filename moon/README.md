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

## Warm bedroom insert

`content/bedroom.glb` replaces only the old living-room furniture/interior lining.
`moon-bedroom.ts` retains the pressure hull and other rooms, installs the new
furniture colliders, and preserves the companion's route through the bedroom
and outer workroom. Bedding uses settled Blender cloth with embedded textile maps.
The rug is a single 11 mm shell, shortened to leave 37 cm before the bedside
cabinet. Its edge stripe is a material band rather than separate tubes.
The wardrobe uses a generated photographic garment texture on shallow curved
surfaces, with an open hanging bay above a closed lower storage door.
The former entrance holographic desk, wall panel and floor planter
have been removed; its corner remains empty.

Lighting is a 4096 px Cycles diffuse atlas (512 samples, direct and indirect
light), denoised with Blender's compositor. Material UV0 and lighting UV1 stay
separate. Coated surfaces remain dielectric; room-specific cubemap reflections
and restrained HDR bloom finish the interior. Bloom selects only actual bedroom
emitters and runs while the player is inside the bedroom. The connecting passage
has its own matte finishes and reduced lamp energy to prevent the washed-out
doorway view. Displays, emissive fittings and baked light follow the
existing base-power state. The main rear touch desk remains operational.

Rebuild with Blender 5.1:
`blender -b --python-exit-code 1 --python model-source/moon/build-bedroom.py -- --bake --render`.
The diagnostic render, editable blend, linear lighting master and denoised PNG
are saved in `work/bedroom`. Run `python scripts/encode-bedroom-lighting.py`
(Pillow required), then `node scripts/pack-moon-model.mjs bedroom` and
`node scripts/verify-bedroom.mjs`. The packer requires matching model and atlas
metadata and versions the two files together. The optional model argument
avoids rewriting unrelated assets during local review.

`bedroom-preview.html` is a local Vite review page, with fixed views of the bed,
bed edge, rug, bedside, workstation, wardrobe and outward passage, free movement
and a lighting switch. It is
not a production build entry. The approved room is accessed through the existing
workroom passage on `/moon/`; production excludes the preview toolbar.
Verification: browser inspection of the actual MoonWorld renderer, 72 passing
tests (including route clearance, passage material isolation, the cleared corner
and scoped old-furniture removal), and a Vite
build to the temporary `work/bedroom/build` directory.
