import {STARTERS,DEFAULT_WORLD,DIRECTIVES,SKILLS,ROLE_SKILL,EQUIPMENT} from './data.js';
export const uid=()=>globalThis.crypto.randomUUID();
export const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export function random(){return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;}
export function createGame(name='세계 1',demo=true){
 const catalog=demo?structuredClone(STARTERS):[];
 return {version:1,mode:demo?'demo':'ai',id:uid(),name,created:Date.now(),world:structuredClone(DEFAULT_WORLD),directives:{...DIRECTIVES},catalog,owned:Object.fromEntries(catalog.map(c=>[c.id,{id:c.id,level:1,ascend:0,awaken:0,shards:0,skillLevel:1,gear:{},bond:0}])),party:catalog.map(c=>c.id),presets:[],gold:18000,gems:4800,xp:100,essence:30,stamina:120,staminaAt:Date.now(),pity:{standard:0,limited:0},guarantee:false,pull4:{standard:0,limited:0},history:[],equipment:[],stories:{},characterStories:{},choices:[],completed:[],claimed:[],quests:{battles:0,pulls:0,upgrades:0},images:{},imageJobs:{},chapter:1,settings:{autoImages:false},daily:'',battle:null};
}
export function recover(s,now=Date.now()){const ticks=Math.floor((now-s.staminaAt)/300000);if(ticks>0){s.stamina=Math.min(120,s.stamina+ticks);s.staminaAt+=ticks*300000;}return s;}
export function charStats(c,o,equipment=[]){
 const role={striker:[560,94,30,105],guardian:[870,62,55,85],healer:[650,68,36,97],support:[630,74,34,110]}[c.role];
 const factor=(1+(o.level-1)*.075)*(1+o.ascend*.12)*(1+o.awaken*.05)*(1+(c.rarity-3)*.06);
 const out=Object.fromEntries(['hp','atk','def','speed'].map((k,i)=>[k,Math.round(role[i]*(i===3?1:factor))]));
 for(const id of Object.values(o.gear)){const g=equipment.find(x=>x.id===id);if(g)out[EQUIPMENT[g.slot].stat]+=Math.round(EQUIPMENT[g.slot].base*(1+g.level*.18)*(1+(g.rarity-3)*.3));}return out;
}
export function summon(s,banner='standard',count=1,rng=random){
 if(!['standard','limited'].includes(banner)||![1,10].includes(count))throw Error('잘못된 소환 요청');
 if(!s.catalog.some(c=>c.rarity===5)||!s.catalog.some(c=>c.rarity===4)||!s.catalog.some(c=>c.rarity===3))throw Error('3·4·5성 캐릭터가 모두 필요합니다. 세계를 먼저 생성하세요.');
 if(s.gems<count*160)throw Error('성정석이 부족합니다.');
 const results=[];s.gems-=count*160;
 for(let i=0;i<count;i++){
 let pity=++s.pity[banner];let p5=pity>=90?1:Math.min(1,.02+Math.max(0,pity-73)*.06);let roll=rng();let rarity=roll<p5?5:roll<p5+.13?4:3;
 if(++s.pull4[banner]>=10&&rarity===3)rarity=4;
 if(rarity>=4)s.pull4[banner]=0;
 if(rarity===5)s.pity[banner]=0;
 let pool=s.catalog.filter(c=>c.rarity===rarity);const featured=s.catalog.find(c=>c.rarity===5);
 if(banner==='limited'&&rarity===5){if(s.guarantee||rng()<.5){pool=[featured];s.guarantee=false;}else {pool=pool.filter(c=>c.id!==featured.id);if(!pool.length)pool=[featured];s.guarantee=pool[0].id!==featured.id;}}
 const c=pool[Math.floor(rng()*pool.length)];let duplicate=!!s.owned[c.id];
 if(duplicate)s.owned[c.id].shards+=({3:10,4:20,5:40})[rarity];else s.owned[c.id]={id:c.id,level:1,ascend:0,awaken:0,shards:0,skillLevel:1,gear:{},bond:0};
 results.push({id:c.id,rarity,duplicate});s.history.unshift({name:c.name,rarity,banner,at:Date.now()});
 }s.history=s.history.slice(0,500);s.quests.pulls+=count;return results;
}
export function upgrade(s,id,kind){const o=s.owned[id];if(!o)throw Error('미보유 캐릭터');
 let gold=0,xp=0,essence=0,shards=0;
 if(kind==='level'){if(o.level>=Math.min(60,20+o.ascend*10))throw Error('레벨 상한입니다. 돌파하세요.');gold=o.level*120;xp=Math.ceil(o.level/3);}
 else if(kind==='ascend'){if(o.ascend>=4||o.level<20+o.ascend*10)throw Error('현재 레벨 상한에 도달해야 합니다.');gold=2000*(o.ascend+1);essence=5*(o.ascend+1);}
 else if(kind==='awaken'){if(o.awaken>=6)throw Error('최대 각성');shards=20+o.awaken*10;gold=1000*(o.awaken+1);}
 else if(kind==='skill'){if(o.skillLevel>=10||o.skillLevel>=o.level)throw Error('스킬 상한 또는 캐릭터 레벨이 부족합니다.');gold=o.skillLevel*350;xp=o.skillLevel*2;}
 else throw Error('잘못된 강화 종류');
 if(s.gold<gold||s.xp<xp||s.essence<essence||o.shards<shards)throw Error('재료가 부족합니다.');
 s.gold-=gold;s.xp-=xp;s.essence-=essence;o.shards-=shards;
 if(kind==='level')o.level++;else if(kind==='skill')o.skillLevel++;else o[kind]++;
 s.quests.upgrades++;
}
export function makeGear(level=1,rng=random){return {id:uid(),slot:['weapon','armor','charm'][Math.floor(rng()*3)],rarity:rng()<.12?5:rng()<.4?4:3,level:0,sourceLevel:level};}
export function enhanceGear(s,id){const g=s.equipment.find(x=>x.id===id);if(!g||g.level>=15)throw Error('강화할 수 없습니다.');const cost=(g.level+1)*400;if(s.gold<cost)throw Error('골드가 부족합니다.');s.gold-=cost;g.level++;}
export function equip(s,character,id){const o=s.owned[character],g=s.equipment.find(x=>x.id===id);if(!o||!g)throw Error('장비를 선택하세요.');for(const x of Object.values(s.owned))for(const k in x.gear)if(x.gear[k]===id)delete x.gear[k];o.gear[g.slot]=id;}
export function startBattle(s,{level=1,chapter=null,dungeon=null,stage=1,enemyContent=[]},rng=random){
 recover(s);if(s.battle&&!s.battle.result)throw Error('진행 중인 전투가 있습니다.');if(!s.party.length)throw Error('파티를 편성하세요.');
 if(chapter&&(!Number.isInteger(chapter)||chapter<1||chapter>12||chapter>s.chapter||![1,2,3].includes(stage)||(stage>1&&!s.completed.includes(`${chapter}-${stage-1}`))))throw Error('이전 시나리오를 완료하세요.');
 if(dungeon&&!['gold','xp','gear','ascend'].includes(dungeon))throw Error('잘못된 던전');
 const cost=dungeon?15:10;if(s.stamina<cost)throw Error('행동력이 부족합니다.');s.stamina-=cost;
 const allies=s.party.filter(id=>s.owned[id]).map(id=>{const c=s.catalog.find(x=>x.id===id),o=s.owned[id],st=charStats(c,o,s.equipment);return {...st,id,name:c.name,element:c.element,role:c.role,skill:c.skill,skillLevel:o.skillLevel,maxHp:st.hp,shield:0,cd:0,buff:0,weak:0};});
 const enemies=Array.from({length:dungeon?3:stage===3?3:2},(_,i)=>{let boss=stage===3&&i===0;let hp=Math.round((boss?1050:460)*(1+(level-1)*.15));return {id:`enemy-${i}`,name:enemyContent[i]?.name||(boss?'항로 파수꾼':['균열의 잔영','부유 감시체','궤도 포식자'][i]),hp,maxHp:hp,atk:Math.round((boss?76:47)*(1+(level-1)*.12)),def:15+level*3,speed:80+i*8,element:enemyContent[i]?.element||['dark','fire','wind'][i],skill:'strike',skillLevel:1,role:'striker',shield:0,cd:0,buff:0,weak:0};});
 s.battle={id:uid(),level,chapter,dungeon,stage,round:1,allies,enemies,queue:[],log:['전투 시작'],result:null,rewarded:false};refill(s.battle);return s.battle;
}
function refill(b){b.queue=[...b.allies,...b.enemies].filter(x=>x.hp>0).sort((a,b)=>b.speed-a.speed).map(x=>x.id);}
export function currentActor(b){return [...b.allies,...b.enemies].find(x=>x.id===b.queue[0]);}
export function advantage(a,b){return ({fire:'wind',wind:'water',water:'fire',light:'dark',dark:'light'})[a]===b?1.25:1;}
export function act(b,kind='basic',targetId=null,rng=random){
 if(b.result)return;const actor=currentActor(b);if(!actor)throw Error('전투 차례 오류');
 const friendly=b.allies.includes(actor),own=friendly?b.allies:b.enemies,foes=friendly?b.enemies:b.allies;
 let skill=kind==='skill'?SKILLS[actor.skill]:null;if(skill&&actor.cd>0)throw Error('스킬 재사용 대기 중');
 if(kind==='guard'){actor.shield+=Math.round(actor.maxHp*.15);b.log.push(`${actor.name} 방어`);}else{
 const noncombat=!skill&&['healer','support'].includes(actor.role);
 const type=skill?.target||(noncombat?'ally':'enemy');let targets=type==='allEnemies'?foes.filter(x=>x.hp>0):type==='allAllies'?own.filter(x=>x.hp>0):type==='ally'?[own.filter(x=>x.hp>0).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]]:[foes.find(x=>x.id===targetId&&x.hp>0)||foes.find(x=>x.hp>0)];
 for(const t of targets){if(!t)continue;let power=(skill?.power||1)*(1+(actor.skillLevel-1)*.05);
 if((skill&&actor.skill==='mend')||(noncombat&&actor.role==='healer')){let n=Math.round(actor.atk*(noncombat?.8:power));t.hp=Math.min(t.maxHp,t.hp+n);b.log.push(`${actor.name} → ${t.name} 회복 +${n}`);}
 else if((skill&&actor.skill==='ward')||(noncombat&&actor.role==='support')){t.shield+=Math.round(actor.atk*power+actor.maxHp*.1);b.log.push(`${t.name} 보호막`);}
 else if(skill&&actor.skill==='rally'){t.buff=3;b.log.push(`${t.name} 공격력 증가 3턴`);}
 else {let crit=rng()<.12;let n=Math.max(1,Math.round(actor.atk*power*(actor.buff>0?1.2:1)*advantage(actor.element,t.element)*(100/(100+t.def*(t.weak>0?.7:1)))*(crit?1.5:1)));let blocked=Math.min(t.shield,n);t.shield-=blocked;t.hp=Math.max(0,t.hp-(n-blocked));if(skill&&actor.skill==='weaken')t.weak=3;b.log.push(`${actor.name} → ${t.name} ${n}${crit?' 치명타':''}`);}
 }
 }if(skill)actor.cd=skill.cooldown+1;actor.cd=Math.max(0,actor.cd-1);actor.buff=Math.max(0,actor.buff-1);actor.weak=Math.max(0,actor.weak-1);
 b.queue.shift();b.queue=b.queue.filter(id=>[...b.allies,...b.enemies].some(x=>x.id===id&&x.hp>0));
 if(!b.enemies.some(x=>x.hp>0))b.result='win';else if(!b.allies.some(x=>x.hp>0))b.result='lose';
 else if(!b.queue.length){b.round++;if(b.round>60)b.result='lose';else refill(b);}
 b.log=b.log.slice(-60);return b.result;
}
export function autoAct(b,rng=random){const a=currentActor(b);return act(b,a.cd===0?'skill':'basic',null,rng);}
export function settle(s,rng=random){const b=s.battle;if(!b?.result||b.rewarded)return null;b.rewarded=true;
 if(b.result!=='win')return {gold:0,gems:0,xp:0,essence:0};
 const first=b.chapter&&!s.completed.includes(`${b.chapter}-${b.stage}`);const r={gold:500+b.level*80,gems:first?80:0,xp:4+Math.floor(b.level/3),essence:1};
 if(b.dungeon==='gold')r.gold*=4;if(b.dungeon==='xp')r.xp*=4;if(b.dungeon==='ascend')r.essence=5;
 if(b.dungeon==='gear'||rng()<.25)s.equipment.push(makeGear(b.level,rng));for(const k in r)s[k]+=r[k];
 if(first){s.completed.push(`${b.chapter}-${b.stage}`);if(b.stage===3)s.chapter=Math.max(s.chapter,b.chapter+1);}
 s.quests.battles++;for(const id of s.party)s.owned[id].bond++;return r;
}
export function daily(s,day=new Date().toLocaleDateString('en-CA')){if(s.daily===day)throw Error('오늘 보상을 받았습니다.');s.daily=day;s.gems+=160;s.gold+=1000;s.xp+=10;s.stamina=Math.min(120,s.stamina+40);}
export const ACHIEVEMENTS=[{id:'battle1',name:'첫 번째 항로',key:'battles',need:1,gems:160},{id:'battle10',name:'숙련된 관측자',key:'battles',need:10,gems:320},{id:'pull10',name:'새로운 인연',key:'pulls',need:10,gems:320},{id:'upgrade10',name:'성장의 기록',key:'upgrades',need:10,gems:160}];
export function claim(s,id){let a=ACHIEVEMENTS.find(x=>x.id===id);if(!a||s.claimed.includes(id)||s.quests[a.key]<a.need)throw Error('수령 조건 미달');s.claimed.push(id);s.gems+=a.gems;}
export function buy(s,item){const offers={xp:{cost:500,key:'xp',amount:10},essence:{cost:1200,key:'essence',amount:5},stamina:{cost:100,key:'stamina',amount:60,currency:'gems'}};let o=offers[item];if(!o)throw Error('없는 상품');let k=o.currency||'gold';if(s[k]<o.cost)throw Error('재화 부족');if(item==='stamina'&&s.stamina>60)throw Error('행동력 60 이하에서 구매할 수 있습니다.');s[k]-=o.cost;s[o.key]+=o.amount;}
export function validateSave(s){if(!s||s.version!==1||!(/^[a-zA-Z0-9-]{1,80}$/.test(s.id))||!Array.isArray(s.catalog)||!s.owned||!Array.isArray(s.party)||!s.world||!s.directives||!s.pity||!s.pull4||!s.quests||!s.stories||!s.characterStories||!s.images||!s.imageJobs||!s.settings||!Array.isArray(s.history)||!Array.isArray(s.completed)||!Array.isArray(s.equipment)||!Array.isArray(s.claimed)||!Array.isArray(s.choices)||!Array.isArray(s.presets))throw Error('지원하지 않는 저장 파일');for(const k of ['gold','gems','xp','essence','stamina','staminaAt','chapter'])if(!Number.isFinite(s[k])||s[k]<0)throw Error('저장 수치 오류');if(s.catalog.length>300||s.party.length>4||s.party.some(id=>!s.owned[id]||!s.catalog.some(c=>c.id===id)))throw Error('캐릭터 데이터 오류');for(const c of s.catalog)if(!/^[a-zA-Z0-9-]{1,80}$/.test(c.id)||!c.name||![3,4,5].includes(c.rarity)||!['striker','guardian','healer','support'].includes(c.role)||!['fire','water','wind','light','dark'].includes(c.element)||!SKILLS[c.skill])throw Error('캐릭터 규격 오류');for(const [id,o] of Object.entries(s.owned)){if(!s.catalog.some(c=>c.id===id)||!o.gear)throw Error('보유 캐릭터 오류');for(const [key,min,max] of [['level',1,60],['ascend',0,4],['awaken',0,6],['shards',0,1000000],['skillLevel',1,10],['bond',0,1000000]])if(!Number.isInteger(o[key])||o[key]<min||o[key]>max)throw Error('성장 데이터 오류');}
 if(new Set(s.catalog.map(c=>c.id)).size!==s.catalog.length||new Set(s.party).size!==s.party.length)throw Error('중복 캐릭터 오류');
 for(const g of s.equipment)if(!/^[a-zA-Z0-9-]{1,80}$/.test(g.id)||!EQUIPMENT[g.slot]||![3,4,5].includes(g.rarity)||!Number.isInteger(g.level)||g.level<0||g.level>15)throw Error('장비 데이터 오류');
 for(const data of Object.values(s.images))if(typeof data!=='string'||!/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(data))throw Error('저장 이미지 형식 오류');
 if(s.battle){const b=s.battle;if(!Array.isArray(b.allies)||!b.allies.length||!Array.isArray(b.enemies)||!b.enemies.length||!Array.isArray(b.queue)||!Array.isArray(b.log)||![null,'win','lose'].includes(b.result))throw Error('전투 저장 오류');const units=[...b.allies,...b.enemies];for(const u of units){if(!u.id||!SKILLS[u.skill]||!['striker','guardian','healer','support'].includes(u.role))throw Error('전투 캐릭터 오류');for(const k of ['hp','maxHp','atk','def','speed','shield','cd','buff','weak'])if(!Number.isFinite(u[k])||u[k]<0)throw Error('전투 수치 오류');}if(!b.result&&(!b.queue.length||b.queue.some(id=>!units.some(u=>u.id===id))))throw Error('전투 행동 순서 오류');}
 return s;}
