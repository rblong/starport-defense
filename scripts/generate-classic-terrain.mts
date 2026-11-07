/** Offline layout only. Uses the optional MIT scm-js ISOM implementation.
 * Upstream code/license remain in ignored artifacts/starcraft1/scm-js.
 * Does not enter the game bundle. See docs/14-classic-terrain-rebuild.md.
 */
import fs from 'node:fs';
import {decodeCv5} from '../artifacts/starcraft1/scm-js/src/formats/tileset/decode.ts';
import {flatTerrain} from '../artifacts/starcraft1/scm-js/src/formats/tileset/terrain.ts';
import {paintIsom,diamondAt,checkIsom} from '../artifacts/starcraft1/scm-js/src/editor/isom-standalone.ts';
import {LEVEL_ONE,pathToPixels,gridToPixel} from '../src/data/level01.ts';
const cv=fs.readFileSync('artifacts/starcraft1/tileset/jungle.cv5');
const ts:any={groups:decodeCv5(cv)};
let seed=14621;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const width=80,height=20;
const {tiles,isom}=flatTerrain(width,height,{id:8,group:8},ts,random,4);
const scn:any={width,height,era:4,tiles,isom,editorTiles:tiles.slice(),dirty:new Set()};
const paint=(x:number,y:number,id:number,size=1)=>paintIsom(scn,ts,diamondAt(x,y),id,size,random);
const route=pathToPixels(LEVEL_ONE),pads=LEVEL_ONE.pads.map(p=>gridToPixel(p));
// Continuous classic grass/dirt edge sets, selected by StarEdit's diamond brush.
for(let i=1;i<route.length;i++){
 const a=route[i-1],b=route[i],length=Math.hypot(b.x-a.x,b.y-a.y);
 for(let d=0;d<=length;d+=24)paint(a.x+(b.x-a.x)*d/length,a.y+(b.y-a.y)*d/length,2);
}
// Broad natural clearings connect the lane to the human defensive positions.
for(const p of pads)if(random()>.35)paint(p.x,p.y,2);
// Raised jungle on the north/south perimeter; authored clusters, real stacked cliff tiles.
for(const [x,y] of [[90,40],[210,40],[350,35],[860,50],[980,50],[1090,50],[2090,40],[2200,40],[2280,40],[50,600],[180,600],[300,610],[1860,600],[1980,610],[2100,610]])paint(x,y,9,2);
const check=checkIsom(scn,ts);
const highAt=(x:number,y:number)=>{
 if(x<0||x>=width*32||y<0||y>=height*32)return false;
 const group=scn.tiles[Math.floor(y/32)*width+Math.floor(x/32)]>>4;
 return Boolean(ts.groups[group].flags & 0x600);
};
const highRoute:Array<{x:number;y:number}>=[];
for(let i=1;i<route.length;i++){
 const a=route[i-1],b=route[i],length=Math.hypot(b.x-a.x,b.y-a.y);
 for(let d=0;d<=length;d+=8){const x=a.x+(b.x-a.x)*d/length,y=a.y+(b.y-a.y)*d/length;if(highAt(x,y))highRoute.push({x,y});}
}
const highPads=pads.filter(p=>highAt(p.x,p.y));
if(check.mismatched||highRoute.length||highPads.length)throw Error('Terrain edges or playable positions are invalid');
fs.writeFileSync('artifacts/classic-terrain-verification.json',JSON.stringify({isom:check,sourcePixels:[width*32,height*32],routeHighGroundSamples:highRoute,padHighGroundCount:highPads.length},null,2));
fs.writeFileSync('artifacts/starcraft1/classic-terrain.json',JSON.stringify({width,height,tiles:Array.from(scn.tiles),check,seed}));
console.log(JSON.stringify({check,groups:new Set(Array.from(scn.tiles,(t:any)=>t>>4)).size}));
