# Maps every icon's codepoint to the glyph its name's ligature draws. A static FILL=1 instance
# keeps some filled glyphs reachable only by ligature (the variable font swapped them in by
# feature variation); React Native draws icons by codepoint, so the map has to name them.
# Usage: python3 fix-cmap.py FONT.ttf NAMES.json  (NAMES: {"favorite": 59517, ...})
import json
import sys

from fontTools.ttLib import TTFont

font_path, names_path = sys.argv[1], sys.argv[2]
names = json.load(open(names_path))
font = TTFont(font_path)
cmap = font.getBestCmap()
glyph_of_char = {chr(code): glyph for code, glyph in cmap.items() if code < 0x80}

ligatures = {}
for lookup in font['GSUB'].table.LookupList.Lookup:
    for sub in lookup.SubTable:
        sub = getattr(sub, 'ExtSubTable', sub)
        for first, ligs in getattr(sub, 'ligatures', {}).items():
            for lig in ligs:
                ligatures[(first, *lig.Component)] = lig.LigGlyph

from fontTools.ttLib.tables._c_m_a_p import CmapSubtable

# Codepoints past U+FFFF don't fit the 16-bit format-4 map: they go in a 32-bit format-12 one.
if any(code > 0xFFFF for code in names.values()) and not any(t.format == 12 for t in font['cmap'].tables):
    wide = CmapSubtable.newSubtable(12)
    wide.platformID, wide.platEncID, wide.language = 3, 10, 0
    wide.cmap = dict(cmap)
    font['cmap'].tables.append(wide)

missing = []
for name, code in names.items():
    key = tuple(glyph_of_char.get(ch) for ch in name)
    glyph = ligatures.get(key)
    if glyph is None:
        missing.append(name)
        continue
    for table in font['cmap'].tables:
        if table.isUnicode() and (table.format != 4 or code <= 0xFFFF):
            table.cmap[code] = glyph
if missing:
    sys.exit(f'{font_path}: no ligature for {", ".join(missing)}')
font.save(font_path)
print(f'{font_path}: {len(names)} codepoints mapped to their ligature glyphs')
