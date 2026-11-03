# Cloud sources

All five are Blender renders with real alpha transparency (no cut-out backgrounds), from one pack:

- Pack: "Clouds with Transparency" by WickedInsignia, OpenGameArt
  https://opengameart.org/content/clouds-with-transparency
- Licence: CC0 1.0 (public domain dedication), as stated on that page:
  https://creativecommons.org/publicdomain/zero/1.0/ — no attribution required.

| file             | original (2048x2048 PNG, RGBA / grey+alpha)                                                  |
| ---------------- | -------------------------------------------------------------------------------------------- |
| cumulus-a.webp   | https://opengameart.org/sites/default/files/oga-textures/136561/fx_cloudalpha03.png          |
| cumulus-b.webp   | https://opengameart.org/sites/default/files/oga-textures/136561/fx_cloudalpha06.png          |
| cumulus-c.webp   | https://opengameart.org/sites/default/files/oga-textures/136561/fx_cloudalpha10.png          |
| scatter.webp     | https://opengameart.org/sites/default/files/oga-textures/136561/fx_cloudalpha05.png          |
| haze.webp        | https://opengameart.org/sites/default/files/oga-textures/136561/fx_cloudalpha01.png          |

Processing: cropped to the alpha bounding box (+24px padding), resized to 768px on the long
side (Lanczos), converted to greyscale luminance, alpha stretched so the densest 0.3% is opaque
(some renders top out at alpha 70-100/255), saved as WebP q82 with alpha. Drawn by
src/components/common/Clouds.tsx, which dithers them onto the dither layer's cell grid.
