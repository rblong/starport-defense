import fs from 'node:fs';
const pages = await (await fetch('http://127.0.0.1:9233/json')).json();
const socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
await new Promise(r => socket.addEventListener('open', r, { once: true }));
let serial = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); }
  else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result?.value;
};
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:5173/' });
await sleep(1800);
for (let i = 0; i < 40; i++) {
  if (await evaluate(`Boolean(window.__starportGame?.scene.isActive('MenuScene'))`)) break;
  await sleep(250);
}
const menuShot = await send('Page.captureScreenshot', { format:'png' });
fs.writeFileSync('artifacts/screenshots/135-menu-current.png', Buffer.from(menuShot.data,'base64'));
const menuCheck = await evaluate(`({title:document.title,background:window.__starportGame.textures.exists('terran-menu'),texts:window.__starportGame.scene.getScene('MenuScene').children.list.filter(o=>o.type==='Text').map(o=>o.text)})`);
if (!menuCheck.title.includes('星际塔防') || !menuCheck.texts.includes('星际塔防') || !menuCheck.background) throw Error('Menu title/background mismatch');
const startPoint = await evaluate(`(()=>{const r=document.querySelector('#game canvas').getBoundingClientRect();return{x:r.left+183/1280*r.width,y:r.top+363/720*r.height};})()`);
await send('Input.dispatchMouseEvent',{type:'mousePressed',...startPoint,button:'left',buttons:1,clickCount:1});
await send('Input.dispatchMouseEvent',{type:'mouseReleased',...startPoint,button:'left',buttons:0,clickCount:1});
await sleep(1100);
const snapshot = await evaluate(`(()=>{const s=window.__starportScene;const u=s.scene.get('UIScene'); return {cards:u.cards.map(c=>c.unit.id),canvas:[s.game.canvas.width,s.game.canvas.height],pathLength:s.pathData.totalLength,pads:s.pads.length};})()`);
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync('artifacts/screenshots/'+name, Buffer.from(r.data, 'base64')); };
await shot('136-terrain-current.png');
const steps = [{name:'Terran menu and game rename',title:menuCheck.title}];
const assert = (condition, message) => { if (!condition) throw Error(message); };
const point = async (x, y) => evaluate(`(()=>{const r=document.querySelector('#game canvas').getBoundingClientRect();return {x:r.left+${x}/1280*r.width,y:r.top+${y}/720*r.height};})()`);
const mouse = async (type, x, y, held = false) => {
  const p = await point(x, y);
  await send('Input.dispatchMouseEvent', { type, ...p, button: type === 'mouseMoved' && !held ? 'none' : 'left', buttons: held ? 1 : 0, clickCount: 1 });
};
const click = async (x, y) => { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, true); await mouse('mouseReleased', x, y); await sleep(100); };
const drag = async (x, y, tx, ty) => {
  await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, true);
  for (let i = 1; i <= 8; i++) { await mouse('mouseMoved', x + (tx-x)*i/8, y + (ty-y)*i/8, true); await sleep(22); }
  await mouse('mouseReleased', tx, ty); await sleep(130);
};
const waitFor = async expression => { for (let i=0;i<80;i++) { if (await evaluate(expression)) return; await sleep(150); } throw Error('Timed out: '+expression); };
await click(235, 653);
const musicCheck = await evaluate(`(()=>{const audio=window.__starportAudio;return {label:audio.getMusicLabel(),loop:audio.music?.loop,volume:audio.music?.volume,playing:audio.music?!audio.music.paused:false};})()`);
if (!musicCheck.loop) throw Error('Music loop did not initialize');
steps.push({name:'Original background music initialized after pointer gesture',...musicCheck});
const musicSettings = await evaluate(`(()=>{const a=window.__starportAudio;a.setMusicVolume(0);const zero=a.music.paused&&a.music.volume===0;a.setMusicVolume(.5);a.setVolume(.5);a.setMuted(true);const muted=a.music.paused;a.setMuted(false);const before=a.musicEnabled;a.toggleMusic();const disabled=a.music.paused&&JSON.parse(localStorage.getItem('starport-defense:v1:settings')).musicEnabled===false;if(before)a.toggleMusic();return{zero,muted,disabled};})()`);
assert(musicSettings.zero&&musicSettings.muted&&musicSettings.disabled,'Music settings did not control playback');
steps.push({name:'Music responds to independent music volume, mute, and persisted switch',...musicSettings});

await waitFor(`window.__starportScene.readyUnits.length===1`);
const pads = await evaluate(`window.__starportScene.pads.map(p=>({x:p.x,y:p.y}))`);
// Verify illegal drops preserve the manufactured unit before placing it.
await drag(674, 678, 100, 180);
assert(await evaluate(`window.__starportScene.readyUnits.length===1 && window.__starportScene.towers.length===0`), 'Invalid drop consumed unit');
await drag(674, 678, pads[0].x, pads[0].y);
assert(await evaluate(`window.__starportScene.towers[0]?.typeId==='marine'`), 'Marine drag deployment failed');
steps.push('Marine: real production, invalid drop, drag deployment');
// Seed currency only; manufacture and deployment still use actual UI inputs.
await evaluate(`(()=>{const s=window.__starportScene;s.crystals=3000;s.speed=5;s.emitHud(true);return true;})()`);
for (const x of [348, 460, 572]) await click(x, 653);
await waitFor(`window.__starportScene.readyUnits.length===3`);
for (const pad of [pads[2], pads[4], pads[6]]) await drag(674, 678, pad.x, pad.y);
const units = await evaluate(`window.__starportScene.towers.map(t=>({id:t.typeId,scale:t.view.body.scaleX,width:t.view.body.displayWidth}))`);
assert(units.length===4, 'Four units did not deploy');
assert(units[0].width < units[1].width && units[1].width < units[2].width && units[2].width < units[3].width, 'Unit proportions invalid');
steps.push({ name: 'Four manufactured units and proportions', units });
await click(pads[0].x, pads[0].y);
const before = await evaluate(`window.__starportScene.towers[0].view.body.scaleX`);
await click(888, 685);
const after = await evaluate(`({level:window.__starportScene.towers[0].level,scale:window.__starportScene.towers[0].view.body.scaleX})`);
assert(after.level===2 && after.scale===before, 'Upgrade altered unit scale');
steps.push('Upgrade works and preserves scale');
await shot('137-units-current.png');
const recoil = await evaluate(`(async()=>{const s=window.__starportScene,t=s.towers[0],v=t.view;const start={x:v.container.x,y:v.container.y};let min=Infinity,max=-Infinity;for(const speed of [1,5]){s.tweens.timeScale=speed;for(let i=0;i<100;i++){v.recoil();await new Promise(r=>setTimeout(r,12));min=Math.min(min,v.body.y);max=Math.max(max,v.body.y);}}await new Promise(r=>setTimeout(r,300));s.tweens.timeScale=1;return{start,end:{x:v.container.x,y:v.container.y},min,max,rest:v.body.y,terrain:s.textures.exists('sc-terrain-classic')};})()`);
assert(recoil.rest===-3&&recoil.min>=-3&&recoil.max<=-.5&&recoil.start.y===recoil.end.y,'Marine recoil drifted');
assert(recoil.terrain,'Real Jungle terrain did not load');
steps.push({name:'200 interrupted recoil cycles at 1x/5x retain fixed position; real Jungle tiles loaded',...recoil});
await evaluate(`(()=>{const s=window.__starportScene;s.speed=1;for(let i=0;i<12;i++)s.spawnEnemy(i%3===0?'brute':'scout',4,200+i*30);return true;})()`);
await sleep(450);
await shot('138-combat-current.png');
const frames1 = await evaluate(`window.__starportScene.enemies.filter(e=>e.alive).map(e=>({id:e.id,frame:e.view.sprite.frame.name}))`);
await sleep(280);
const frames2 = await evaluate(`window.__starportScene.enemies.filter(e=>e.alive).map(e=>({id:e.id,frame:e.view.sprite.frame.name}))`);
assert(frames2.some(e=>frames1.some(a=>a.id===e.id && a.frame!==e.frame)), 'Locomotion frames did not change');
await evaluate(`(()=>{window.__starportScene.pauseGame();return true;})()`);
const paused1 = await evaluate(`window.__starportScene.enemies.map(e=>e.view.sprite.frame.name)`);
await sleep(260);
const paused2 = await evaluate(`window.__starportScene.enemies.map(e=>e.view.sprite.frame.name)`);
assert(JSON.stringify(paused1)===JSON.stringify(paused2), 'Walk animation continued while paused');
await evaluate(`(()=>{window.__starportScene.resumeGame();return true;})()`);
steps.push('Walking changes frames with movement and freezes on pause');
// Minimap moves camera without moving the HUD.
await click(156, 666);
const pan = await evaluate(`window.__starportScene.cameraViewX`);
assert(pan>500, 'Minimap did not pan camera');
await shot('139-base-current.png');
steps.push({name:'Minimap pan',viewX:pan});
// Smoke test the distributable procedural path without touching local files.
socket.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.method === 'Fetch.requestPaused') {
    void send('Fetch.fulfillRequest', { requestId:m.params.requestId, responseCode:200,
      responseHeaders:[{name:'Content-Type',value:'application/json'}],
      body:Buffer.from('{"available":false}').toString('base64') });
  }
});
await send('Fetch.enable', { patterns:[{urlPattern:'*assets/sc-local/manifest.json*',requestStage:'Request'}] });
await send('Page.reload', { ignoreCache:true }); await sleep(1600);
await waitFor(`Boolean(window.__starportGame?.scene.isActive('MenuScene'))`);
await evaluate(`(()=>{window.__starportGame.scene.getScene('MenuScene').scene.start('GameScene');return true;})()`);
await sleep(700);
const fallback = await evaluate(`(()=>{const s=window.__starportScene;return {local:s.textures.exists('sc-marine'),fallback:s.textures.exists('unit-battlecruiser'),cards:s.scene.get('UIScene').cards.length};})()`);
assert(!fallback.local && fallback.fallback && fallback.cards===4,'Procedural fallback failed');
await evaluate(`(()=>{const s=window.__starportScene;s.readyUnits=['goliath','battlecruiser'];s.emitProduction(true);return true;})()`);
await drag(674,678,pads[0].x,pads[0].y); await drag(674,678,pads[4].x,pads[4].y);
await evaluate(`(()=>{const s=window.__starportScene;s.spawnEnemy('scout',5,280);return true;})()`);
await sleep(250); await shot('140-fallback-current.png');
assert(await evaluate(`window.__starportScene.towers.length===2 && window.__starportScene.enemies.length>0`),'Fallback deployment failed');
steps.push({name:'No local asset pack: four cards, deployment, enemy movement',...fallback});
await send('Emulation.setDeviceMetricsOverride', { width:844,height:390,deviceScaleFactor:1,mobile:false });
await sleep(250); await shot('141-mobile-current.png');
await send('Fetch.disable');
fs.writeFileSync('artifacts/visual-overhaul-verification.json', JSON.stringify({ snapshot, steps, errors }, null, 2));
console.log(JSON.stringify({ snapshot, steps, errors }, null, 2));
socket.close();
