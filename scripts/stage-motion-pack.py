"""Add direction and locomotion sheets to the optional, ignored local pack.

Atlas coordinates come from the source project's unit definitions. Frames share
one scale and origin across the entire animation so silhouettes do not pulse.
Run after stage-starcraft-pack.py; no source images are altered.
"""
from pathlib import Path
import ast
import json
import re
import urllib.request
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'artifacts/starcraft1/images'
DST = ROOT / 'public/assets/sc-local'
REPO = 'GiacomoVespo/starcraft-full-html5'


def read_url(path):
    with urllib.request.urlopen(f'https://raw.githubusercontent.com/{REPO}/main/{path}', timeout=30) as r:
        return r.read()


def array_after(text, label):
    start = text.index('[', text.index(label))
    depth = 0
    for i in range(start, len(text)):
        if text[i] == '[':
            depth += 1
        elif text[i] == ']':
            depth -= 1
            if depth == 0:
                return ast.literal_eval(text[start:i + 1])
    raise ValueError(label)


def main():
    manifest_path = DST / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    definitions = {race: read_url(f'Characters/{race}.js').decode() for race in ['Terran', 'Zerg', 'Protoss']}
    specs = [
        ('Terran', 'terran', 'Marine', 'sc-marine', False),
        ('Terran', 'terran', 'Goliath', 'sc-goliath', False),
        ('Terran', 'terran', 'Tank', 'sc-tank', False),
        ('Terran', 'terran', 'BattleCruiser', 'sc-battlecruiser', False),
        ('Zerg', 'zerg', 'Zergling', 'sc-enemy-zergling', True),
        ('Zerg', 'zerg', 'Hydralisk', 'sc-enemy-hydralisk', True),
        ('Zerg', 'zerg', 'Lurker', 'sc-enemy-lurker', True),
        ('Zerg', 'zerg', 'Ultralisk', 'sc-enemy-ultralisk', True),
    ]
    report = []
    for race, folder, name, key, walking in specs:
        source = SRC / folder / f'{name}.png'
        if not source.exists():
            source.parent.mkdir(parents=True, exist_ok=True)
            source.write_bytes(read_url(f'img/Charas/{name}.png'))
        text = definitions[race]
        unit = text[text.index(name + '='):]
        moving = unit[unit.index('moving:'):]
        left = array_after(moving, 'left:')
        top = array_after(moving, 'top:')
        w = int(re.search(r'\bwidth:\s*(\d+)', unit).group(1))
        h = int(re.search(r'\bheight:\s*(\d+)', unit).group(1))
        frames = len(top[0]) if walking and isinstance(top[0], list) else 1
        atlas = Image.open(source).convert('RGBA')
        crops = []
        for direction in range(16):
            for frame in range(frames):
                x = left[direction][frame] if isinstance(left[direction], list) else left[direction]
                y = top[direction][frame] if isinstance(top[direction], list) else top[direction]
                crops.append(atlas.crop((x, y, x + w, y + h)))
        # Use the union bounding box to preserve animation anchoring.
        boxes = [im.getchannel('A').getbbox() for im in crops]
        boxes = [b for b in boxes if b]
        box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        scale = 88 / max(box[2] - box[0], box[3] - box[1])
        size = (round((box[2] - box[0]) * scale), round((box[3] - box[1]) * scale))
        sheet = Image.new('RGBA', (frames * 96, 16 * 96))
        for i, crop in enumerate(crops):
            crop = crop.crop(box).resize(size, Image.Resampling.NEAREST)
            sheet.alpha_composite(crop, ((i % frames) * 96 + (96 - size[0]) // 2, (i // frames) * 96 + (96 - size[1]) // 2))
        anim_key = key + ('-walk' if walking else '-directions')
        sheet.save(DST / 'images' / f'{anim_key}.png')
        # The icon and world frame now share the same padding and orientation.
        sheet.crop((0, 0, 96, 96)).save(DST / 'images' / f'{key}.png')
        manifest['images'][key] = f'images/{key}.png'
        manifest['spritesheets'][anim_key] = {'path': f'images/{anim_key}.png', 'frameWidth': 96, 'frameHeight': 96, 'endFrame': frames * 16 - 1}
        report.append({'unit': name, 'framesPerDirection': frames, 'directions': 16, 'sourceCell': [w, h]})
    manifest['images'].pop('sc-carrier', None)
    manifest['spritesheets'].pop('sc-carrier-directions', None)
    manifest['motion'] = report
    # Human command centre: source atlas placement from Building.js.
    building = Image.open(SRC / 'terran/TerranBuilding.png').convert('RGBA').crop((0, 6, 129, 112))
    box = building.getchannel('A').getbbox()
    if box:
        building = building.crop(box)
    building.thumbnail((154, 142), Image.Resampling.NEAREST)
    base = Image.new('RGBA', (192, 192))
    base.alpha_composite(building, ((192 - building.width) // 2, (192 - building.height) // 2))
    base.save(DST / 'images/sc-command-center.png')
    manifest['images']['sc-command-center'] = 'images/sc-command-center.png'
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
