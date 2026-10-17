import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
// Rendering smoke tests with a minimal DOM surface. These are not visual browser tests.
const nodes=new Map();function node(){return {innerHTML:'',textContent:'',style:{},open:false,classList:{add(){},remove(){}},addEventListener(){},append(){},remove(){},click(){},showModal(){this.open=true;},close(){this.open=false;},querySelector(){return {style:{}};}};}
globalThis.document={querySelector:selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);},body:node(),createElement:node};
globalThis.localStorage={getItem(){return null;},setItem(){}};globalThis.sessionStorage={getItem(){return null;},setItem(){}};globalThis.window={addEventListener(){}};
const storage=`let saves=new Map();export async function listGames(){return [...saves.values()]};export async function saveGame(s){saves.set(s.id,structuredClone(s))};export async function loadGame(id){return saves.get(id)};export async function deleteGame(id){saves.delete(id)};export function exportGame(){};export async function importGame(){};`;
let source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');for(const n of ['viewport','portraits','image-prompts','engine','data','ai','progression','events','event-ui','cosmetic-ui'])source=source.replace(`'./${n}.js'`,JSON.stringify(new URL(`../src/${n}.js`,import.meta.url).href));source=source.replace("'./storage.js'",JSON.stringify('data:text/javascript;base64,'+Buffer.from(storage).toString('base64')));source+='\nexport const harness={getState:()=>s,show:v=>{view=v;render();return app.innerHTML;},actions,detail:characterDetail,setStory:()=>{story={key:"1-1",chapter:1,stage:1,character:null,data:demoStory(1,1)};storyIndex=0;}};';
const {harness}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('every main screen renders without runtime errors',()=>{for(const v of ['home','characters','party','gacha','story','dungeons','shop','bag','achievements','events','costumes','studio','settings']){const html=harness.show(v);assert.match(html,/<main[^>]*>/);assert.ok(!html.includes('undefined'),'undefined in '+v);}});
test('character profile, scenario reader, and battle action screens render',async()=>{harness.detail('ael');assert.match(nodes.get('#modal').innerHTML,/아엘/);harness.setStory();assert.match(harness.show('reading'),/다음/);await harness.actions.dungeon({dataset:{tier:'1',dungeon:'gold'}});const html=harness.show('battle');assert.match(html,/일반 공격|기본 회복|기본 보호/);assert.match(html,/행동/);harness.show('home');});
test('event pass, exchange and unlocked costume/gallery screens expose working actions',async()=>{
 const state=harness.getState();
 await harness.actions['event-tab']({dataset:{tab:'pass'}});assert.match(harness.show('events'),/패스 미션/);
 await harness.actions['event-tab']({dataset:{tab:'dungeon'}});assert.match(harness.show('events'),/이벤트 보급 뽑기/);assert.match(harness.show('events'),/event-dungeon/);
 state.player.xp=600;assert.match(harness.show('costumes'),/의상 풀/);assert.ok(state.cosmetics.banners.length);
 harness.actions.gallery({dataset:{character:'ael'}});assert.match(nodes.get('#modal').innerHTML,/기본 이미지/);
});
test('generated banner is not covered by another character portrait; base gallery ignores selected outfit',()=>{
 const state=harness.getState();
 state.images['banner:limited']='data:image/png;base64,YQ==';
 const html=harness.show('gacha');assert.match(html,/banner has-art/);assert.ok(!html.includes('class="banner-art"'));
 delete state.images['banner:limited'];assert.match(harness.show('gacha'),/class="banner-art"/);
 state.images['portrait:ael']='data:image/png;base64,YQ==';
 const old=state.cosmetics.selected.ael;
 state.cosmetics.outfits['test-art']={id:'test-art',characterId:'ael',name:'의상',imageKey:'costume:test-art'};
 state.images['costume:test-art']='data:image/png;base64,Yg==';state.cosmetics.selected.ael='test-art';
 assert.match(harness.show('characters'),/src="data:image\/png;base64,Yg=="/);
 harness.actions.gallery({dataset:{character:'ael'}});
 assert.match(nodes.get('#modal').innerHTML,/src="data:image\/png;base64,YQ=="/);
 delete state.cosmetics.outfits['test-art'];delete state.images['costume:test-art'];
 if(old)state.cosmetics.selected.ael=old;else delete state.cosmetics.selected.ael;
});
test('in-place render retains main scroll while changing pages resets it',()=>{
 const app=nodes.get('#app'),original=app.querySelector;
 const main={dataset:{view:'story'},scrollTop:480},nav={scrollTop:30},shell={style:{}};
 app.querySelector=selector=>selector==='main'?main:selector==='nav'?nav:shell;
 try{harness.show('story');assert.equal(main.scrollTop,480);assert.equal(nav.scrollTop,30);harness.show('home');assert.equal(main.scrollTop,0);}
 finally{app.querySelector=original;}
});
test('new empty world is preserved until valid generation succeeds',async()=>{nodes.set('#new-name',{value:'새 세계'});await harness.actions['create-slot']();const s=harness.getState();assert.equal(s.mode,'ai');assert.equal(s.catalog.length,0);assert.match(harness.show('studio'),/전체 지침/);assert.match(harness.show('home'),/미생성 세계/);});
