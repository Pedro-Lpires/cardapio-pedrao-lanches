"""Prepara arquivos WebP locais, mantendo os originais até a conferência final."""
from pathlib import Path
from PIL import Image, ImageOps
import json

root = Path(__file__).resolve().parents[1]
images = root / "images"
aliases = {}
converted = []

def webp(source, dest, size, force=False):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if force or not dest.exists():
        with Image.open(source) as image:
            image = ImageOps.exif_transpose(image).convert("RGBA")
            image.thumbnail(size, Image.Resampling.LANCZOS)
            image.save(dest, "WEBP", quality=90, method=6)
    with Image.open(dest) as check:
        check.verify()
    converted.append({"original": source.relative_to(root).as_posix(),
                      "webp": dest.relative_to(root).as_posix(),
                      "antes": source.stat().st_size, "depois": dest.stat().st_size})

manifest = json.loads((images / "avatares/manifest.json").read_text(encoding="utf-8-sig"))
ids = ["maionese", "ketchup", "barbecue", "caseiro", "mignon", "salada",
       "coquinha", "conversa", "adicionais", "desconto"]
for character, identity in zip(manifest["characters"], ids, strict=True):
    for rank, filename in character["files"].items():
        source = images / "avatares" / filename
        tier = "sem-rank" if rank == "normal" else rank
        dest = images / "avatares" / tier / (identity + ".webp")
        webp(source, dest, (256, 256), force=True)
        aliases[source.relative_to(root).as_posix()] = dest.relative_to(root).as_posix()
    character["identity"] = identity
    character["files"] = {rank: f"{rank}/{identity}.webp" for rank in
                          ["sem-rank", "bronze", "prata", "ouro", "diamante", "imortal"]}
    character.pop("sha256", None)
manifest["ranks"][0] = "sem-rank"
(root / "scripts/avatares-webp-manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

for source in sorted(images.rglob("*")):
    if source.suffix.lower() not in [".png", ".jpg", ".jpeg"] or "avatares" in source.parts:
        continue
    dest = source.with_suffix(".webp")
    # Os recortes usados pelos avisos já foram preparados no diretório ui.
    supplied = source.parent.parent / (source.stem + ".webp") if source.parent.name == "ui" else None
    if supplied and supplied.exists() and not dest.exists():
        dest.write_bytes(supplied.read_bytes())
    webp(source, dest, (1200, 1200))
    aliases[source.relative_to(root).as_posix()] = dest.relative_to(root).as_posix()

(root / "scripts/imagens-webp-aliases.json").write_text(
    json.dumps(aliases, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
(root / "scripts/imagens-webp-relatorio.json").write_text(
    json.dumps(converted, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"arquivos": len(converted), "antes": sum(x["antes"] for x in converted),
                  "depois": sum(x["depois"] for x in converted)}, ensure_ascii=False))
