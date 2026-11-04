"""Write the font lab's kerning into the font it exported.

The lab exports the font and, beside it, its kerning as JSON (opentype.js
can't write kerning). This puts those pairs into the font as a GPOS `kern`
feature, which is what browsers use.

    python add_kerning.py OldEnglishFiveLab.otf OldEnglishFiveLab-kerning.json

The font is rewritten in place unless an output path is given as a third
argument.
"""

import json
import sys

from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.ttLib import TTFont


def main(font_path: str, kerning_path: str, out_path: str | None = None) -> None:
    font = TTFont(font_path)
    names = set(font.getGlyphOrder())
    with open(kerning_path, encoding="utf-8") as f:
        pairs = json.load(f)["pairs"]

    # only pairs whose glyphs are in this font (a deleted glyph drops out)
    kept = [(a, b, k) for a, b, k in pairs if a in names and b in names and k]
    lines = [f"    pos {a} {b} {k};" for a, b, k in kept]
    feature = "languagesystem DFLT dflt;\nlanguagesystem latn dflt;\n\nfeature kern {\n" + "\n".join(lines) + "\n} kern;\n"

    if "GPOS" in font:
        del font["GPOS"]
    addOpenTypeFeaturesFromString(font, feature)
    font.save(out_path or font_path)
    print(f"{len(kept)} kerning pairs written to {out_path or font_path}")


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    main(*sys.argv[1:])
