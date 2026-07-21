import pandas as pd
import json
from pathlib import Path

df = pd.read_csv(r"C:\Users\WinDows\Desktop\MyDesktopApp\cleaned_clex_rx.csv")
df.columns = [str(c).strip() for c in df.columns]
allowed = ["Progressive", "Single Vision", "Bifocal", "Occupational"]
matrix = {}
coating = set()
edging = set()
special = set()

for _, row in df.iterrows():
    t = str(row.iloc[0]).replace('"', "").strip()
    d = str(row.iloc[1]).strip()
    f = str(row.iloc[2]).strip()
    i = str(row.iloc[3]).strip()
    tl = t.lower()
    if not t or tl in ("nan", "", ",,,"):
        continue
    if "fitting" in tl and "edging" not in tl:
        continue
    if "edging" in tl:
        edging.add(t)
        continue
    if "coating" in tl or any(k in tl for k in ["mirror", "solitare", "sapphire", "emerald", "drive"]):
        if "coating options" not in tl:
            coating.add(t)
        continue
    if "tint" in tl:
        continue
    if any(k in tl for k in ["special", "decentration", "edge blending", "engraving", "cyl", "prism"]):
        if "multiple choice" not in tl and tl != "none":
            special.add(t)
        continue
    if tl == "none":
        continue
    matched = next((b for b in allowed if b.lower() in tl), None)
    if not matched:
        continue
    dd = d if d != "nan" else "—"
    ff = f if f != "nan" else "—"
    matrix.setdefault(matched, {}).setdefault(dd, {}).setdefault(ff, [])
    if i != "nan" and i not in matrix[matched][dd][ff]:
        matrix[matched][dd][ff].append(i)

out = {
    "matrix": matrix,
    "coating": ["None"] + sorted(coating),
    "edging": ["None"] + sorted(e for e in edging if "fitting" not in e.lower()),
    "tinting": ["None", "Full", "Gradient"],
    "special": sorted(special),
    "sizes": ["50", "55", "60", "65", "70"],
}

dest = Path(r"C:\Users\WinDows\Desktop\eyeglass-lab-portal\src\data\lensCatalog.json")
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(json.dumps(out, indent=2), encoding="utf-8")
print("ok", list(matrix.keys()), len(out["coating"]), len(out["edging"]), len(out["special"]))
