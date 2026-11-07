"""Extract local-only classic Jungle tiles; source files are not redistributed."""
from pathlib import Path
import json
import struct
import subprocess
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'artifacts/starcraft1/tileset'
DST = ROOT / 'public/assets/sc-local'

def stage_classic():
    upstream = ROOT / 'artifacts/starcraft1/scm-js/src/editor/isom.ts'
    if not upstream.is_file():
        print('optional scm-js ISOM source absent; classic map not rebuilt')
        return
    # A tiny document adapter keeps the offline brush independent of editor UI/i18n.
    source = upstream.read_text(encoding='utf-8')
    source = source.replace('import { markDirty, tilesetIndex, type Scenario } from "../formats/chk/scenario";',
        'type Scenario = any; const markDirty=(s:any,...names:string[])=>{for(const n of names)s.dirty.add(n);}; const tilesetIndex=(s:any)=>s.era&7;')
    source = source.replace('import { mirrorEditorTiles, type TileChange } from "./terrain";',
        'type TileChange={at:number;before:number;after:number;under?:number}; const mirrorEditorTiles=(s:any,c:TileChange[])=>{for(const t of c)s.editorTiles[t.at]=t.after;};')
    upstream.with_name('isom-standalone.ts').write_text(source,encoding='utf-8')
    runner=shutil.which('npx')
    if not runner:
        print('npx unavailable; classic map not rebuilt')
        return
    result=subprocess.run([runner,'--offline','--yes','--package=tsx','tsx','scripts/generate-classic-terrain.mts'],cwd=ROOT,capture_output=True,text=True,timeout=60)
    if result.returncode:
        print('optional ISOM generator needs cached tsx; run npx --yes --package=tsx tsx scripts/generate-classic-terrain.mts once')
        print(result.stderr[-500:])
        return
    print(result.stdout.strip())
    layout=json.loads((ROOT/'artifacts/starcraft1/classic-terrain.json').read_text())
    if layout['check']['mismatched']:
        raise ValueError('Classic terrain ISOM edges do not match')
    palette=(SRC/'jungle.wpe').read_bytes();vr=(SRC/'jungle.vr4').read_bytes()
    vx=(SRC/'jungle.vx4').read_bytes();cv=(SRC/'jungle.cv5').read_bytes()
    image=Image.new('RGB',(layout['width']*32,layout['height']*32));cache={}
    for n,value in enumerate(layout['tiles']):
        if value not in cache:
            mega=struct.unpack_from('<H',cv,(value>>4)*52+20+(value&15)*2)[0]
            tile=Image.new('RGB',(32,32))
            for j in range(16):
                ref=struct.unpack_from('<H',vx,mega*32+j*2)[0]
                mini=Image.new('RGB',(8,8))
                mini.putdata([tuple(palette[k*4:k*4+3]) for k in vr[(ref>>1)*64:(ref>>1)*64+64]])
                if ref&1: mini=mini.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                tile.paste(mini,(j%4*8,j//4*8))
            cache[value]=tile
        image.paste(cache[value],(n%layout['width']*32,n//layout['width']*32))
    image.save(DST/'images/sc-terrain-classic.png')
    path=DST/'manifest.json';manifest=json.loads(path.read_text(encoding='utf-8'))
    manifest['images']['sc-terrain-classic']='images/sc-terrain-classic.png'
    path.write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print('staged native 2560x640 classic terrain; 800 ISOM rectangles, zero mismatches')


def main():
    if not all((SRC / ('jungle.' + ext)).is_file() for ext in ('wpe', 'vr4', 'vx4', 'cv5')):
        print('optional Jungle terrain source absent; using procedural terrain')
        return
    palette = (SRC / 'jungle.wpe').read_bytes()
    vr = (SRC / 'jungle.vr4').read_bytes()
    vx = (SRC / 'jungle.vx4').read_bytes()
    cv = (SRC / 'jungle.cv5').read_bytes()
    atlas = Image.new('RGB', (1024, 3072))
    for group in range(192):
        for variant in range(16):
            mega = struct.unpack_from('<H', cv, group * 52 + 20 + variant * 2)[0]
            for j in range(16):
                value = struct.unpack_from('<H', vx, mega * 32 + j * 2)[0]
                mini = vr[(value >> 1) * 64:(value >> 1) * 64 + 64]
                image = Image.new('RGB', (8, 8))
                image.putdata([tuple(palette[k * 4:k * 4 + 3]) for k in mini])
                if value & 1:
                    image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                atlas.paste(image, ((group % 2) * 512 + variant * 32 + j % 4 * 8, group // 2 * 32 + j // 4 * 8))
    # Classic CV5 groups contain unused/partially blank variation slots.
    # Replace those slots with a complete variant from the same terrain group.
    for group in range(192):
        variants=[]
        for variant in range(16):
            x=(group % 2)*512+variant*32; y=group//2*32
            image=atlas.crop((x,y,x+32,y+32))
            pixels=image.tobytes()
            black=sum(1 for offset in range(0,len(pixels),3) if max(pixels[offset:offset+3])<5)
            variants.append((black,image))
        valid=[image for black,image in variants if black<10]
        if valid:
            for variant,(black,image) in enumerate(variants):
                if black>=10:
                    atlas.paste(valid[variant % len(valid)],((group%2)*512+variant*32,group//2*32))
    (DST / 'images').mkdir(parents=True, exist_ok=True)
    atlas.save(DST / 'images/sc-terrain-jungle.png')
    path = DST / 'manifest.json'
    manifest = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'available': True}
    manifest.setdefault('images', {})['sc-terrain-jungle'] = 'images/sc-terrain-jungle.png'
    path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print('staged local Jungle terrain: 192 groups x 16 variants')

if __name__ == '__main__':
    main()
    stage_classic()
