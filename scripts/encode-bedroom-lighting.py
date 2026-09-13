"""Encode the Cycles lighting atlas for delivery; run after the bedroom bake."""
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[1]
source=root/'work/bedroom/bedroom-lighting.png'
target=root/'moon/public/content/bedroom-lighting.webp'
# This is an engineering format conversion, not a modification of the garment art.
with Image.open(source) as image:
    if image.size!=(4096,4096):raise ValueError('Unexpected lighting atlas dimensions')
    image.convert('RGB').save(target,'WEBP',quality=95,method=6)
print(f'Bedroom lighting transfer: {source.stat().st_size:,} -> {target.stat().st_size:,} bytes')
