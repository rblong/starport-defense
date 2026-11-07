import fs from 'node:fs';
const pages = await (await fetch('http://127.0.0.1:9233/json')).json();
const ws = new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();const errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);});
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result?.value;};
await send('Runtime.enable');await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride',{width:1600,height:900,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'http://127.0.0.1:5173/'});
for(let i=0;i<70;i++){await sleep(200);if(await evaluate(`Boolean(window.__starportGame?.scene.isActive('MenuScene'))`))break;}
const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('artifacts/screenshots/'+name,Buffer.from(r.data,'base64'));};
const snapshot=()=>evaluate(`(()=>{const g=window.__starportGame;const s=g.scene.getScene('MenuScene');const t=g.textures.get('orbital-earth-live');let sum=0;const d=t.context.getImageData(0,0,t.width,t.height).data;for(let i=0;i<d.length;i+=97)sum=(sum+d[i])%1000000007;const ship=s.children.list.find(o=>o.type==='Container'&&o.list?.some(p=>p.texture?.key==='battlecruiser-hero'));return{earth:sum,shipX:ship.x,shipY:ship.y,angle:ship.rotation,fps:g.loop.actualFps};})()`);
await sleep(550);const before=await snapshot();await shot('126-orbital-menu.png');await sleep(1900);const after=await snapshot();await shot('127-orbital-menu-motion.png');
if(before.earth===after.earth||before.shipY===after.shipY)throw Error('Menu animation remained static');
// Trigger the real user-gesture audio gate, then observe hover/confirmation.
const point=async(x,y)=>evaluate(`(()=>{const r=document.querySelector('#game canvas').getBoundingClientRect();return{x:r.left+${x}/1280*r.width,y:r.top+${y}/720*r.height};})()`);
const click=async(x,y)=>{const p=await point(x,y);for(const type of ['mouseMoved','mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,...p,button:type==='mouseMoved'?'none':'left',buttons:type==='mousePressed'?1:0,clickCount:1});await sleep(160);};
await click(330,494); // Volume setting: opens the sound gate without leaving menu.
const hover=await point(160,494);await send('Input.dispatchMouseEvent',{type:'mouseMoved',...hover,button:'none'});await sleep(100);
const sounds=await evaluate(`(()=>{const a=window.__starportAudio;return{hover:a.lastPlayed.has('uiHover'),confirmation:a.lastExternalPlayed.has('Button')||a.lastPlayed.has('click'),unlocked:a.context?.state};})()`);
if(!sounds.hover||!sounds.confirmation)throw Error('Button sounds were not triggered');
// Freeze animation through the actual reduce-motion control.
await click(175,494);const frozenA=await snapshot();await sleep(500);const frozenB=await snapshot();
if(frozenA.earth!==frozenB.earth||frozenA.shipY!==frozenB.shipY)throw Error('Reduced motion did not freeze orbital scene');
await click(175,494);
const voice=await evaluate(`(()=>{const a=window.__starportAudio;a.setMuted(false);a.setVolume(.5);a.lastVoicePlayed.clear();a.lastExternalPlayed.clear();a.playVoice('goliath','select');const g=a.lastExternalPlayed.has('Marine.selected');a.lastVoicePlayed.clear();a.lastExternalPlayed.clear();a.playVoice('battlecruiser','select');const b=a.lastExternalPlayed.has('Marine.selected');return{goliath:g,battlecruiser:b};})()`);
if(!voice.goliath||!voice.battlecruiser)throw Error('Unit voice did not fall back to Marine');
const failedVoice=await evaluate(`(async()=>{const a=window.__starportAudio;a.setStarCraftPack(false,[]);a.lastVoicePlayed.clear();const broken=new Audio();broken.play=()=>Promise.reject(new Error('simulated missing unit voice'));a.voiceElements.set('goliath-select',broken);a.voiceElements.delete('marine-select');a.playVoice('goliath','select');await new Promise(r=>setTimeout(r,350));const fallback=Boolean(a.voiceElements.get('marine-select')&&!a.voiceElements.get('marine-select').paused);a.setMuted(true);a.voiceElements.delete('marine-select');a.lastVoicePlayed.clear();a.setMuted(false);a.playVoice('goliath','select');a.setMuted(true);await new Promise(r=>setTimeout(r,100));const muted=!a.voiceElements.has('marine-select');a.setMuted(false);return{fallback,muted};})()`);
if(!failedVoice.fallback||!failedVoice.muted)throw Error('Failed WAV fallback or mute guard failed');
const report={before,after,sounds,reducedMotionFrozen:true,marineVoiceFallback:voice,failedVoice,errors};
fs.writeFileSync('artifacts/orbital-menu-verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));ws.close();
