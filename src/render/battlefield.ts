import Phaser from 'phaser';
import { BATTLE_TOP, BATTLE_BOTTOM, WORLD_WIDTH, RENDER_SCALE, DEPTH } from '../game/constants';
import { LEVEL_ONE, gridToPixel, pathToPixels } from '../data/level01';
import { buildPath, samplePath } from '../domain/path';

/** Exterior colony terrain; art layers never alter the simulation's route. */
export function drawStarport(scene: Phaser.Scene): void {
  // Native 32px tiles, paired CV5 variations, ISOM edges and vertically stacked
  // cliffs are resolved offline. No rescaling, alpha terrain mixing or overlays.
  if (scene.textures.exists('sc-terrain-classic')) {
    scene.add.image(WORLD_WIDTH / 2, 320, 'sc-terrain-classic').setDepth(DEPTH.path - 2);
    return;
  }
  const source = scene.textures.exists('sc-terrain-jungle') ? scene.textures.get('sc-terrain-jungle').getSourceImage() as HTMLImageElement : null;
  const key = source ? 'colony-terrain-sc-jungle-v2' : 'colony-terrain-v2';
  if (!scene.textures.exists(`${key}-0`)) {
    const height = BATTLE_BOTTOM - BATTLE_TOP;
    const canvas = document.createElement('canvas');
    canvas.width = WORLD_WIDTH * RENDER_SCALE; canvas.height = height * RENDER_SCALE;
    const c = canvas.getContext('2d')!;
    let seed = 701;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
    const hash = (x: number, y: number) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
    const noise = (x: number, y: number) => {
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      const a = fx * fx * (3 - 2 * fx), b = fy * fy * (3 - 2 * fy);
      return (hash(ix,iy)*(1-a)+hash(ix+1,iy)*a)*(1-b)+(hash(ix,iy+1)*(1-a)+hash(ix+1,iy+1)*a)*b;
    };
    const terrain = document.createElement('canvas'); terrain.width = WORLD_WIDTH; terrain.height = height;
    const tc = terrain.getContext('2d')!; const pixels = tc.createImageData(WORLD_WIDTH,height);
    for(let y=0;y<height;y++) for(let x=0;x<WORLD_WIDTH;x++) {
      const broad = noise(x/195,y/160), detail = noise(x/23,y/20), grain = hash(x,y);
      const grass = Math.max(0,Math.min(1,(broad + Math.sin(x/430)*0.13 - 0.48)*4));
      const shade = (detail-0.5)*18 + (grain-0.5)*17;
      const sand = noise(x/390+8,y/260+2);
      const index = (y*WORLD_WIDTH+x)*4;
      pixels.data[index] = (103+sand*23)*(1-grass) + 48*grass + shade;
      pixels.data[index+1] = (91+sand*18)*(1-grass) + 65*grass + shade;
      pixels.data[index+2] = (62+sand*14)*(1-grass) + 35*grass + shade*0.6;
      pixels.data[index+3]=255;
    }
    tc.putImageData(pixels,0,0);
    const tile = (ctx: CanvasRenderingContext2D, group: number, variant: number, x: number, y: number, size: number) => {
      if (source) ctx.drawImage(source, group % 2 * 512 + variant * 32, Math.floor(group / 2) * 32, 32, 32, x, y, size, size);
    };
    const material = (group: number): CanvasPattern | null => {
      if (!source) return null;
      const patch = document.createElement('canvas'); patch.width = 192; patch.height = 192;
      const pc = patch.getContext('2d')!; pc.imageSmoothingEnabled = false;
      for (let y=0;y<4;y++) for(let x=0;x<4;x++) tile(pc,group,y*4+x,x*48,y*48,48);
      return c.createPattern(patch, 'repeat');
    };
    const grassMaterial=material(8), sandMaterial=material(4), cliffMaterial=material(45);
    if (source) {
      tc.imageSmoothingEnabled = false;
      const grassLayer=document.createElement('canvas');grassLayer.width=WORLD_WIDTH;grassLayer.height=height;
      const gc=grassLayer.getContext('2d')!;gc.imageSmoothingEnabled=false;
      for (let y=0;y<height;y+=48) for(let x=0;x<WORLD_WIDTH;x+=48) {
        tile(tc,4+Math.floor(rand()*2),Math.floor(rand()*16),x,y,48);
        tile(gc,8+Math.floor(rand()*2),Math.floor(rand()*16),x,y,48);
      }
      const grassPixels=gc.getImageData(0,0,WORLD_WIDTH,height);
      for(let y=0;y<height;y++)for(let x=0;x<WORLD_WIDTH;x++) {
        const blend=Math.max(0,Math.min(1,(noise(x/195,y/160)+Math.sin(x/430)*.13-.42)*6));
        grassPixels.data[(y*WORLD_WIDTH+x)*4+3]=blend*255;
      }
      gc.putImageData(grassPixels,0,0);tc.drawImage(grassLayer,0,0);
    }
    c.drawImage(terrain,0,0,canvas.width,canvas.height);
    c.scale(RENDER_SCALE,RENDER_SCALE); c.translate(0,-BATTLE_TOP);
    const route = pathToPixels(LEVEL_ONE), path = buildPath(route), pads=LEVEL_ONE.pads.map(p=>gridToPixel(p));
    const routeDistance = (x:number,y:number) => {
      let distance=Infinity;
      for(let i=1;i<route.length;i++) {
        const a=route[i-1]!,b=route[i]!,dx=b.x-a.x,dy=b.y-a.y;
        const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));
        distance=Math.min(distance,Math.hypot(x-a.x-dx*t,y-a.y-dy*t));
      }
      return distance;
    };
    const clear = (x:number,y:number,r=42) => routeDistance(x,y)>r && !pads.some(p=>Math.hypot(p.x-x,p.y-y)<r);
    const polygon = (points:readonly (readonly [number,number])[],fill:string) => {
      c.fillStyle=fill;c.beginPath();c.moveTo(points[0]![0],points[0]![1]);
      for(const p of points.slice(1)) c.lineTo(p[0],p[1]);c.closePath();c.fill();
    };
    // Windblown grass tufts and irregular pebbles are baked once.
    for(let i=0;i<(source ? 0 : 4000);i++) {
      const x=rand()*WORLD_WIDTH,y=BATTLE_TOP+rand()*height;
      if(noise(x/195,(y-BATTLE_TOP)/160)+Math.sin(x/430)*0.13<0.52)continue;
      c.strokeStyle=rand()>.5?'rgba(130,140,70,.34)':'rgba(22,43,18,.45)';c.lineWidth=.7;
      c.beginPath();c.moveTo(x,y);c.lineTo(x-1+rand()*2,y-2-rand()*4);c.stroke();
    }
    const stroke=(width:number,color:string|CanvasPattern)=>{
      c.strokeStyle=color;c.lineWidth=width;c.lineJoin='round';c.lineCap='round';c.beginPath();c.moveTo(route[0]!.x,route[0]!.y);
      for(const p of route.slice(1))c.lineTo(p.x,p.y);c.stroke();
    };
    if (sandMaterial) {
      const road=document.createElement('canvas');road.width=WORLD_WIDTH;road.height=height;
      const rc=road.getContext('2d')!;rc.fillStyle=sandMaterial;rc.fillRect(0,0,WORLD_WIDTH,height);
      rc.fillStyle='rgba(170,145,94,.12)';rc.fillRect(0,0,WORLD_WIDTH,height);
      const rp=rc.getImageData(0,0,WORLD_WIDTH,height);
      for(let y=0;y<height;y++)for(let x=0;x<WORLD_WIDTH;x++){
        const distance=routeDistance(x,y+BATTLE_TOP);
        const shoulder=40+(noise(x/18,y/18)-.5)*7;
        rp.data[(y*WORLD_WIDTH+x)*4+3]=Math.max(0,Math.min(1,(shoulder-distance)/12))*246;
      }
      rc.putImageData(rp,0,0);c.drawImage(road,0,BATTLE_TOP);
    } else {
      stroke(85,'rgba(40,35,23,.20)');stroke(72,'rgba(103,87,53,.55)');stroke(61,'#97815a');stroke(48,'#a38d65');
    }
    for(let d=0;d<path.totalLength;d+=14) {
      const p=samplePath(path,d),nx=-Math.sin(p.angle),ny=Math.cos(p.angle);
      for(const side of [-1,1]) {

        c.fillStyle=rand()>.5?'rgba(64,62,35,.4)':'rgba(160,140,93,.6)';
        // Feathered soil shoulders replace the former repeated stone chain.
        // Two worn crawler tracks leave small, broken marks in the dirt.
        c.fillStyle='rgba(65,53,36,.16)';c.save();c.translate(p.x+nx*side*10,p.y+ny*side*10);c.rotate(p.angle);c.fillRect(-1,-3,2,6);c.restore();
      }
      c.fillStyle='rgba(220,197,142,.16)';c.fillRect(p.x-18+rand()*36,p.y-18+rand()*36,1,1);
    }
    const rock=(x:number,y:number,size:number)=>{
      c.save();c.translate(x,y);c.rotate(rand()*2);
      c.fillStyle='rgba(18,21,16,.30)';c.beginPath();c.ellipse(4,5,size*1.2,size*.6,0,0,Math.PI*2);c.fill();
      polygon([[-size,-size*.3],[-size*.5,-size*.8],[size*.35,-size*.65],[size,size*.1],[size*.5,size*.6],[-size*.6,size*.55]],'#62665a');
      polygon([[-size,-size*.3],[-size*.5,-size*.8],[size*.35,-size*.65],[size*.4,0],[-size*.35,size*.12]],'#91917a');
      polygon([[size*.4,0],[size*.35,-size*.65],[size,size*.1],[size*.5,size*.6]],'#434c43');
      c.strokeStyle='#b3ab8a';c.lineWidth=.7;c.beginPath();c.moveTo(-size*.5,-size*.72);c.lineTo(size*.25,-size*.55);c.stroke();c.restore();
    };
    for(let i=0;i<90;i++) {
      const x=20+rand()*(WORLD_WIDTH-40),y=BATTLE_TOP+20+rand()*(height-40),size=2+rand()*8;
      if(clear(x,y,size+35))rock(x,y,size);
    }
    // Raised mesas, exposed southern cliff faces and layered strata.
    const mesa=(x:number,y:number,w:number,h:number)=>{
      const top:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[
        [x,y+18],[x+28,y],[x+w-32,y+5],[x+w,y+29],[x+w-16,y+h-14],[x+w*.55,y+h],[x+18,y+h-9]];
      const lower=top.map(p=>[p[0]+5,p[1]+28] as [number,number]);
      polygon(lower,'rgba(15,24,19,.45)');
      for(let i=3;i<top.length-1;i++) {
        const a=top[i]!,b=top[i+1]!;
        polygon([a,b,[b[0],b[1]+22],[a[0],a[1]+22]],i%2?'#424b40':'#53594a');
        if(cliffMaterial){c.save();c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.lineTo(b[0],b[1]+22);c.lineTo(a[0],a[1]+22);c.closePath();c.clip();c.fillStyle=cliffMaterial;c.fillRect(x-5,y,w+10,h+30);c.restore();}
        for(let line=10;line<22;line+=12){c.strokeStyle=line%2?'#6d705b':'#303b32';c.lineWidth=1;c.beginPath();c.moveTo(a[0],a[1]+line);c.lineTo(b[0],b[1]+line);c.stroke();}
      }
      polygon(top,'#8d8967');c.save();c.beginPath();c.moveTo(top[0][0],top[0][1]);for(const p of top.slice(1))c.lineTo(p[0],p[1]);c.closePath();c.clip();
      if(grassMaterial){c.fillStyle=grassMaterial;c.fillRect(x,y,w,h);}
      for(let i=0;i<w*h/35;i++){c.fillStyle=rand()>.45?'rgba(59,79,37,.35)':'rgba(207,189,133,.24)';c.fillRect(x+rand()*w,y+rand()*h,2+rand()*10,1+rand()*4);}
      for(let i=0;i<14;i++)rock(x+rand()*w,y+rand()*h,3+rand()*8);c.restore();
      c.strokeStyle='rgba(161,153,119,.35)';c.lineWidth=1;c.beginPath();c.moveTo(top[0][0],top[0][1]);for(const p of top.slice(1))c.lineTo(p[0],p[1]);c.closePath();c.stroke();
    };
    mesa(870,103,230,84);mesa(1990,105,216,85);
    // The base is the one engineered island in an exterior colony landscape.
    const core=gridToPixel(LEVEL_ONE.core);
    c.fillStyle='rgba(27,34,31,.45)';c.fillRect(core.x-87,core.y-62,181,137);
    c.fillStyle='#58645a';c.fillRect(core.x-82,core.y-67,164,126);
    c.strokeStyle='#8d9c8b';c.lineWidth=2;c.strokeRect(core.x-82,core.y-67,164,126);
    for(let x=core.x-78;x<core.x+78;x+=14){c.fillStyle='#c5b574';c.fillRect(x,core.y+54,7,3);}
    // Small field service crates are sparse and stay away from route/pads.
    for(const [x,y] of [[430,145],[1440,460],[2270,143]]) {
      if(!clear(x!,y!,50))continue;
      c.fillStyle='rgba(14,22,16,.4)';c.fillRect(x!-17,y!-9,42,28);
      c.fillStyle='#596451';c.fillRect(x!-21,y!-15,38,26);c.strokeStyle='#92947a';c.lineWidth=1;c.strokeRect(x!-21,y!-15,38,26);
      c.strokeStyle='#2f3b32';c.beginPath();c.moveTo(x!-15,y!-12);c.lineTo(x!+13,y!+7);c.moveTo(x!+13,y!-12);c.lineTo(x!-15,y!+7);c.stroke();
    }
    for(let i=0;i<2;i++) {
      const chunk=document.createElement('canvas');chunk.width=canvas.width/2;chunk.height=canvas.height;
      chunk.getContext('2d')!.drawImage(canvas,i*chunk.width,0,chunk.width,chunk.height,0,0,chunk.width,chunk.height);
      scene.textures.addCanvas(`${key}-${i}`,chunk);
    }
  }
  for(let i=0;i<2;i++) scene.add.image(WORLD_WIDTH*(i+.5)/2,(BATTLE_TOP+BATTLE_BOTTOM)/2,`${key}-${i}`).setScale(1/RENDER_SCALE).setDepth(DEPTH.path-2);
}
