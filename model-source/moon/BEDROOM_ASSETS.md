# Bedroom v3 assets

- Garment: `model-source/moon/textures/crew-jacket-v1.png`, original transparent RGBA,
  generated with the built-in image tool in **new-image / product-mockup** mode.
  No reference image was sent to the generation tool. Its original alpha is
  preserved, and the PNG is embedded in `moon/public/content/bedroom.glb`.
- The cloth silhouette is mapped to two shallow curved surfaces inside the
  wardrobe. This is a photographic cutout treatment, not a fully simulated
  jacket mesh. The original disconnected procedural sleeves are removed.
- The wardrobe follows the supplied structure: a recessed hanging bay with a
  rail light and stacked cases, above a closed lower cabinet with an inset grip.
  Printed labels are inset from both sides of the cabinet face.
- `build-bedroom-textiles.py` settles the duvet and throw against the mattress
  and bed frame using Blender cloth collisions. The static, thickened result
  is cached in `work/bedroom/textiles-<recipe-hash>.blend` for repeatable bakes.
  The 2.20 x 4.00 m rug is one closed 11 mm shell, with a sewn material band and
  a 37 cm gap before the bedside cabinet. It has no stacked slabs or tube edging.
- `moon/public/content/bedroom-lighting.webp`: 4096 px, Blender Cycles diffuse
  lighting (512 samples, five diffuse bounces), compositor denoising, sRGB data
  encoded at gain 4. UV1 contains the lighting atlas; UV0 keeps textile detail.
- `moon/public/content/bedroom.glb`, `bedroom-packed.bin` and the light atlas are
  versioned by `moon/app/moon-bedroom-assets.json`. Source blends and linear EXR
  masters are in `work/bedroom`, outside the delivery bundle.
- Runtime bloom includes only the bedroom's actual light fittings. The passage
  uses separate matte interior finishes and lower lamp energy, keeping bright
  walls out of the glow pass and avoiding a white veil when looking out.
- The bedroom is integrated into the existing `/moon/` scene and entered through
  the workroom passage. Production includes the compressed model and lighting,
  with no separate bedroom page or preview controls.
- Authoring preview: `http://127.0.0.1:5204/moon/bedroom-preview.html`. This page
  stays outside the production build. Publication was approved after local review.

## Exact image-generation prompt

Use case: product-mockup. Asset type: a photorealistic transparent RGBA garment cutout for a wardrobe in a lunar-habitat 3D game. Generate ONE real, waist-length off-white astronaut crew flight jacket hanging naturally on ONE thin simple metal clothes hanger. Portrait 2:3 canvas. Strictly straight-on front view, neutral lens, no perspective tilt. The whole hanger hook, both shoulders, both relaxed empty sleeves, ribbed cuffs and bottom hem are fully visible, with a small transparent margin. No person, mannequin, body, pants, room, wardrobe, rail or floor. Absolutely transparent background and transparent space inside the hanger and around the sleeves; no painted checkerboard, no background shadow or halo. The jacket must look like a finely photographed physical garment: realistic soft densely woven technical cotton fabric, natural gravity folds, fine double stitching, a restrained central zipper, two credible small inset chest pockets, a folded soft collar, tiny unlettered slate-gray circular mission patch. Believable tailoring and proportions, not an inflated spacesuit, not a lab coat, not melted or stiff sculpted fabric. Warm stone-white material, modest use wear. Broad diffuse soft frontal lighting with very gentle warm highlights and readable fabric detail; restrained shading suitable for use as a game albedo asset. No text or watermark. High-resolution crisp alpha edges and authentic textile microstructure.
