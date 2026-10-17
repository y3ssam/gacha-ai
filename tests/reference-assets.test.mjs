import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createGame,summon,startBattle,validateSave} from '../src/engine.js';
const root=new URL('../',import.meta.url);
test('all eleven imported PNGs retain their original hashes and dimensions',async()=>{
 const provenance=JSON.parse(await readFile(new URL('assets/reference/provenance.json',root),'utf8'));
 assert.equal(provenance.assets.length,11);
 for(const asset of provenance.assets){
  const bytes=await readFile(new URL(asset.file,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  assert.equal(bytes.subarray(1,4).toString(),'PNG');
  const size=[bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
  assert.deepEqual(size,asset.source.includes('/dungeons/')?[1024,1536]:[1254,1254]);
 }
});
test('new production games never include sample lore, characters, equipment or scenarios',()=>{
 const game=createGame();assert.equal(game.mode,'ai');assert.equal(game.catalog.length,0);assert.deepEqual(game.party,[]);
 assert.deepEqual(game.equipment,[]);assert.deepEqual(game.stories,{});assert.equal(game.world.lore,'');
 const before=JSON.stringify(game);assert.throws(()=>summon(game));assert.equal(JSON.stringify(game),before);
 assert.throws(()=>startBattle(game,{dungeon:'gold'}));assert.equal(game.stamina,120);
 assert.equal(validateSave(JSON.parse(JSON.stringify(game))).catalog.length,0);
});
test('the game includes original component CSS and connects imported assets through local relative paths',async()=>{
 const css=await readFile(new URL('src/reference.css',root),'utf8');
 for(const selector of ['.game-bottom-menu','.character-portrait-card','.summon-banner','.dungeon-detail-layout','.inventory-item'])assert.ok(css.includes(selector));
 const html=await readFile(new URL('index.html',root),'utf8');assert.ok(html.includes('src/reference.css'));assert.ok(html.includes('src/integration.css'));
 const code=await readFile(new URL('src/reference-ui.js',root),'utf8');assert.ok(code.includes('assets/reference/'));assert.ok(!code.includes('https://raw.githubusercontent.com'));
});
