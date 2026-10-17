import * as Engine from '../../src/engine.js';
import {STARTERS,DEFAULT_WORLD} from './starter-data.mjs';
export function createFixtureGame(name='테스트 세계',populated=true){
 const s=Engine.createGame(name);if(!populated)return s;
 s.catalog=structuredClone(STARTERS);s.world=structuredClone(DEFAULT_WORLD);
 s.owned=Object.fromEntries(s.catalog.map(c=>[c.id,{id:c.id,level:1,ascend:0,awaken:0,shards:0,skillLevel:1,gear:{},bond:0}]));s.party=s.catalog.map(c=>c.id);s.settings.autoImages=false;return s;
}
