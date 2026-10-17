import {APPEARANCE_SCHEMA,validateAppearance,identityPrompt,validateClothing,characterCaption,validateCgPlan,IMAGE_PLAN_SCHEMA} from './image-prompts.js';
// Staged content generation. All intermediate outputs are drafts, never live economy.
import {SKILLS,ELEMENTS,ENEMY_ARCHETYPES} from './data.js';
import {migrateProgress,releaseCycle,installRelease} from './progression.js';
const uuid=()=>crypto.randomUUID();
const str=(v,max=4000)=>typeof v==='string'?v.trim().slice(0,max):'';
const required=(v,name,max)=>{const result=str(v,max);if(!result)throw Error(`${name} 누락`);return result;};
export const CHARACTER_SLOTS=[
  {rarity:5,role:'guardian'},{rarity:5,role:'striker'},
  {rarity:4,role:'striker'},{rarity:4,role:'support'},{rarity:4,role:'healer'},
  {rarity:3,role:'striker'},{rarity:3,role:'healer'},{rarity:3,role:'support'}
];
export const ENEMY_TYPES=Object.keys(ENEMY_ARCHETYPES);
function jobFor(s,key,slots){
  migrateProgress(s);const snapshot=JSON.stringify(s.directives);
  let job=s.generation.jobs[key];
  if(!job||job.directives!==snapshot){job={key,status:'pending',stage:'',directives:snapshot,checkpoints:{},visualVersion:2,slots:slots.map((slot,i)=>({...slot,id:uuid(),key:`slot-${i+1}`})),attempts:0};s.generation.jobs[key]=job;}
  if(job.visualVersion!==2){if(job.checkpoints.characters){for(const phase of ['characters','outfits','campaign','banner'])delete job.checkpoints[phase];delete job.chapterBatches;}job.visualVersion=2;}
  return job;
}
export function validateCharacters(data,slots,existing=[]){
  if(!Array.isArray(data?.characters)||data.characters.length!==slots.length)throw Error(`캐릭터는 지정한 ${slots.length}개 슬롯을 모두 채워야 합니다.`);
  const names=new Set(existing.map(c=>c.name.normalize('NFKC').trim().toLowerCase())),seen=new Set(),identities=new Set(existing.filter(c=>c.naiAppearance).map(c=>identityPrompt(c.naiAppearance).toLowerCase()));
  return data.characters.map((c,i)=>{
    const slot=slots.find(p=>p.key===c.slotKey);
    if(!slot||seen.has(slot.key)||c.rarity!==slot.rarity||c.role!==slot.role||!ELEMENTS[c.element]||!SKILLS[c.skill])throw Error('캐릭터 슬롯·역할·등급·스킬 계약 오류');
    if(c.role==='healer'&&!['mend','ward'].includes(c.skill)||c.role==='support'&&!['rally','ward'].includes(c.skill))throw Error('비전투 역할에 공격 스킬이 배정되었습니다.');
    const name=required(c.name,'캐릭터 이름',60),normalized=name.normalize('NFKC').toLowerCase();
    if(names.has(normalized))throw Error('중복된 캐릭터 이름');names.add(normalized);seen.add(slot.key);
    const naiAppearance=validateAppearance(c.naiAppearance),identity=identityPrompt(naiAppearance);if(identities.has(identity.toLowerCase()))throw Error('다른 캐릭터와 외형 프롬프트가 동일합니다.');identities.add(identity.toLowerCase());
    return {id:slot.id,name,naiAppearance,identityPrompt:identity,visualProfileVersion:2,rarity:slot.rarity,role:slot.role,element:c.element,skill:c.skill,skillName:required(c.skillName,'스킬 이름',80),profile:required(c.profile,'프로필',4000),appearance:identity,portrait:i%4};
  });
}
export function validateBible(data){
  const w=data?.world;if(!w||!Array.isArray(w.fixedRules)||!w.fixedRules.length||!Array.isArray(w.factions))throw Error('세계 규칙·세력 규격 오류');
  return {title:required(w.title,'세계 제목',80),lore:required(w.lore,'세계관',6000),protagonist:required(w.protagonist,'주인공',1500),imagePrompt:required(w.imagePrompt,'세계 이미지',2000),fixedRules:w.fixedRules.slice(0,20).map(x=>required(x,'고정 규칙',600)),factions:w.factions.slice(0,12).map(x=>required(x,'세력',300))};
}
export function validateEnemies(data,ids){
  if(!Array.isArray(data?.enemies)||data.enemies.length!==ids.length)throw Error('적 도감 슬롯 누락');
  const seen=new Set(),names=new Set();
  return data.enemies.map(x=>{const slot=ids.find(s=>s.key===x.slotKey);if(!slot||seen.has(slot.key)||!ELEMENTS[x.element]||!ENEMY_TYPES.includes(x.archetype))throw Error('적 참조·전투 유형 오류');seen.add(slot.key);const name=required(x.name,'적 이름',60);if(names.has(name))throw Error('중복된 적 이름');names.add(name);return {id:slot.id,name,element:x.element,archetype:x.archetype,lore:required(x.lore,'적 설정',1200),imagePrompt:required(x.imagePrompt,'적 이미지',2000)};});
}
export function validateCampaign(data,characters,enemies,expectedIds=Array.from({length:12},(_,i)=>i+1)){
  if(!Array.isArray(data?.chapters)||data.chapters.length!==expectedIds.length)throw Error('요청한 챕터 설계 수가 일치하지 않습니다.');
  const cast=new Set(characters.map(c=>c.id)),enemyIds=new Set(enemies.map(c=>c.id)),seen=new Set();
  return data.chapters.map(c=>{
    if(!Number.isInteger(c.id)||!expectedIds.includes(c.id)||seen.has(c.id)||!Array.isArray(c.castIds)||!c.castIds.length||c.castIds.some(id=>!cast.has(id))||!Array.isArray(c.stages)||c.stages.length!==3)throw Error('챕터 번호·등장인물·3화 설계 오류');seen.add(c.id);
    const stages=c.stages.map((v,i)=>{if(v.stage!==i+1||!Array.isArray(v.enemyIds)||v.enemyIds.length!==(i===2?3:2)||v.enemyIds.some(id=>!enemyIds.has(id)))throw Error('시나리오 적 도감 참조 오류');return {stage:i+1,title:required(v.title,'화 제목',100),goal:required(v.goal,'장면 목표',600),enemyIds:[...v.enemyIds]};});
    return {id:c.id,title:required(c.title,'챕터 제목',100),summary:required(c.summary,'챕터 개요',1200),castIds:[...c.castIds],stages};
  }).sort((a,b)=>a.id-b.id);
}
export function validateBanner(data,characters,featuredId){
  const b=data?.banner;if(!b||b.featuredId!==featuredId||!characters.some(c=>c.id===featuredId&&c.rarity===5))throw Error('5성 픽업 참조 오류');
  // AI controls presentation only; engine snapshots the complete released catalog.
  const imagePlan=validateCgPlan(b.imagePlan,new Set(characters.map(c=>c.id)));if(imagePlan.cast.some(c=>c.outfitId!=='default'))throw Error('신규 배너는 각 캐릭터의 기본 의상을 사용해야 합니다.');if(!imagePlan.cast.some(c=>c.characterId===featuredId))throw Error('픽업 배너에 표시 캐릭터가 필요합니다.');
  return {id:uuid(),imagePlan,title:required(b.title,'배너 제목',100),description:required(b.description,'배너 설명',1200),imagePrompt:imagePlan.basePrompt,featuredId,poolIds:characters.map(c=>c.id)};
}
const schemas={
  bible:{world:{title:'Korean title',lore:'Korean world bible',protagonist:'confirmed protagonist',fixedRules:['immutable rules honoring instructions'],factions:['faction descriptions'],imagePrompt:'English environmental image tags'}},
  characters:{characters:[{slotKey:'exact supplied slot key',name:'unique Korean name',rarity:'exact slot rarity',role:'exact slot role',element:'fire|water|wind|light|dark',skill:'strike|sweep|mend|ward|weaken|rally',skillName:'Korean skill name',profile:'Korean backstory, relationships and restrictions',naiAppearance:APPEARANCE_SCHEMA}]},
  outfits:{outfits:[{characterId:'exact registered id',outfitPrompt:'English default clothes, garment colors, materials, shoes and carried equipment ONLY. No face/hair/eyes/skin/age/species, pose, counts or background.'}],protagonistAppearance:APPEARANCE_SCHEMA},
  enemies:{enemies:[{slotKey:'exact supplied slot key',name:'unique Korean name',element:'fire|water|wind|light|dark',archetype:'skirmisher|brute|caster|warden',lore:'Korean description',imagePrompt:'English creature tags'}]},
  campaign:{chapters:[{id:'integer 1..12',title:'Korean chapter title',summary:'Korean arc summary and continuity',castIds:['registered character ids'],stages:[{stage:'integer 1..3, sorted',title:'Korean episode title',goal:'specific narrative goal',enemyIds:['exactly 2 known enemy ids for stages 1/2, exactly 3 for stage 3; repeated species allowed']}]}]},
  banner:{banner:{title:'Korean banner title',description:'Korean description',featuredId:'exact supplied featured character id',imagePlan:IMAGE_PLAN_SCHEMA}}
};
export async function runGeneration(s,key,{slots=CHARACTER_SLOTS,phases=['bible','characters','outfits','enemies','campaign','banner'],request,checkpoint=async()=>{},expansion=false}={}){
  const job=jobFor(s,key,slots);if(!Array.isArray(job.slots)||job.slots.length!==slots.length||job.slots.some((v,i)=>v.role!==slots[i].role||v.rarity!==slots[i].rarity||!/^[-a-zA-Z0-9]{1,80}$/.test(v.id)))throw Error('생성 작업 슬롯 저장 오류');job.status='running';job.attempts++;job.error='';
  job.enemySlots??=Array.from({length:6},(_,i)=>({key:`enemy-${i+1}`,id:uuid()}));
  try{
    for(const stage of phases){
      if(job.checkpoints[stage]){
        const d=job.checkpoints;
        if(stage==='bible')d.bible=validateBible({world:d.bible});
        else if(stage==='characters')d.characters=validateCharacters({characters:d.characters.map(c=>({...c,slotKey:job.slots.find(v=>v.id===c.id)?.key}))},job.slots,expansion?s.catalog:[]);
        else if(stage==='outfits')d.outfits=validateDefaultOutfits(d.outfits,d.characters||s.catalog,phases.includes('bible'));
        else if(stage==='enemies')d.enemies=validateEnemies({enemies:d.enemies.map(c=>({...c,slotKey:job.enemySlots.find(v=>v.id===c.id)?.key}))},job.enemySlots);
        else if(stage==='campaign')d.campaign=validateCampaign({chapters:d.campaign},d.characters||s.catalog,d.enemies||s.enemyCatalog);
        else if(stage==='banner'){const prior=d.banner;const safe=validateBanner({banner:prior},expansion?[...s.catalog,...(d.characters||[])]:d.characters||s.catalog,(d.characters||s.catalog).find(c=>c.rarity===5)?.id);if(!/^[-a-zA-Z0-9]{1,80}$/.test(prior.id))throw Error('배너 ID 오류');d.banner={...safe,id:prior.id};}
        continue;
      }
      job.stage=stage;await checkpoint();
      const draft=job.checkpoints,world=draft.bible||s.world,characters=draft.characters||s.catalog,enemies=draft.enemies||s.enemyCatalog;
      const featuredId=(draft.characters||s.catalog).find(c=>c.rarity===5)?.id;
      const payload={schema:schemas[stage],generationKey:key,stage,draftWorld:world,characterSlots:job.slots,enemySlots:job.enemySlots,includeProtagonist:!expansion&&phases.includes('bible'),protagonistDescription:world.protagonist,outfitTargets:[...characters.map(c=>({id:c.id,name:c.name,profile:c.profile,identityPrompt:c.identityPrompt,naiAppearance:c.naiAppearance})),...(!expansion&&phases.includes('bible')?[{id:'protagonist',profile:world.protagonist}]:[])],registeredCharacters:characters.map(c=>({id:c.id,name:c.name,rarity:c.rarity,role:c.role,element:c.element,profile:expansion?'':c.profile.slice(0,600)})),registeredEnemies:enemies,featuredId,chapterCount:12,stagesPerChapter:3,requirements:stage==='characters'?'Fill every supplied character slot exactly once. Do not rename or replace existing characters. Match established world restrictions, including noncombat powers. Return slotKey, exact rarity and role. Fill EVERY naiAppearance field in English NAI tags. Give each character at least two clear visual differences from others unless fixed lore requires resemblance; preserve the fixed lore. Do NOT include outfits in appearance. Do NOT output generic shared faces or identical appearance records.':stage==='outfits'?'Design one default outfitPrompt per outfitTargets id, preserve confirmed world style and personality. Clothes and equipment only; do not repeat body, face, hair, eye, skin, gender, age or scene tags. If includeProtagonist is true, also return protagonistAppearance using every supplied appearance field, based on protagonistDescription.':stage==='campaign'?'Plan a 12-chapter campaign; return the requested chapter range with 3 stages each, using only registered character/enemy ids. Each chapter advances the prior arc. Do not change confirmed chapters or stories.':stage==='banner'?'Use supplied featuredId exactly; never output probabilities, currency or pity rules. imagePlan must contain each visible character separately, including featuredId, max 6. Use outfitId default for each character. Base prompt contains scene/style only. Never place appearance or clothing in the shared base.':stage==='bible'?'Follow player world instructions; do not invent a fixed default genre. Write explicit invariant rules.':'Fill every enemy slot with a distinct species appropriate to the world. Use only supplied archetypes.'};
      if(stage==='campaign'){
        job.chapterBatches??={};
        for(const start of [1,5,9]){
          const ids=Array.from({length:4},(_,i)=>start+i),batchKey=String(start);
          if(job.chapterBatches[batchKey]){job.chapterBatches[batchKey]=validateCampaign({chapters:job.chapterBatches[batchKey]},characters,enemies,ids);continue;}
          job.stage=`campaign:${start}-${start+3}`;await checkpoint();
          const response=await request('design:campaign',{...payload,chapterRange:[start,start+3],chapterCount:4,previousChapterPlans:Object.values(job.chapterBatches).flat(),requirements:payload.requirements+` Return ONLY chapter ids ${ids.join(',')}, exactly four chapters in this response. Keep summaries and episode goals concise.`});
          job.chapterBatches[batchKey]=validateCampaign(response,characters,enemies,ids);await checkpoint();
        }
        job.checkpoints.campaign=validateCampaign({chapters:Object.values(job.chapterBatches).flat()},characters,enemies);await checkpoint();continue;
      }
      const result=await request(`design:${stage}`,payload);
      job.checkpoints[stage]=stage==='bible'?validateBible(result):stage==='characters'?validateCharacters(result,job.slots,expansion?s.catalog:[]):stage==='outfits'?validateDefaultOutfits(result,characters,phases.includes('bible')):stage==='enemies'?validateEnemies(result,job.enemySlots):stage==='campaign'?validateCampaign(result,characters,enemies):validateBanner(result,expansion?[...s.catalog,...characters]:characters,featuredId);
      await checkpoint();
    }
    job.status='done';job.stage='done';await checkpoint();
    const d=job.checkpoints;
    const characters=(d.characters||s.catalog).map(c=>{const clothing=d.outfits?.outfits.find(o=>o.characterId===c.id)?.outfitPrompt;return clothing?{...c,outfitPrompt:clothing,appearance:characterCaption(c,clothing)}:c;});
    const world=d.bible?{...d.bible,chapterTitles:d.campaign?.map(c=>c.title)||[]}:s.world;
    if(d.bible&&d.outfits?.protagonistAppearance){const appearance=d.outfits.protagonistAppearance;world.protagonistVisual={id:'protagonist',name:'주인공',profile:world.protagonist,naiAppearance:appearance,identityPrompt:identityPrompt(appearance),outfitPrompt:d.outfits.outfits.find(o=>o.characterId==='protagonist').outfitPrompt,visualProfileVersion:2};}
    return {world,characters,enemies:d.enemies||s.enemyCatalog,campaign:d.campaign||s.campaign,banner:d.banner};
  }catch(error){job.status='failed';job.error=error.message;await checkpoint();throw error;}
}
export async function generateRelease(s,{request,checkpoint,now=Date.now()}={}){
  const cycle=releaseCycle(s,now);if(s.live.releases.some(r=>r.cycle===cycle))throw Error('이번 주기의 풀은 이미 추가되었습니다.');
  const draft=await runGeneration(s,`release-${cycle}`,{slots:[{rarity:5,role:['striker','guardian','healer','support'][cycle%4]},{rarity:4,role:['support','healer','striker','guardian'][cycle%4]},{rarity:3,role:['healer','striker','support','guardian'][cycle%4]}],phases:['characters','outfits','banner'],request,checkpoint,expansion:true});
  installRelease(s,draft,cycle,now);await checkpoint?.();return draft;
}
export function validateDefaultOutfits(data,characters,includeProtagonist=false){
 const ids=[...characters.map(c=>c.id),...(includeProtagonist?['protagonist']:[])];
 if(!Array.isArray(data?.outfits)||data.outfits.length!==ids.length)throw Error('기본 의상 슬롯 누락');
 const seen=new Set();const outfits=data.outfits.map(o=>{if(!o||!ids.includes(o.characterId)||seen.has(o.characterId))throw Error('기본 의상 캐릭터 참조 오류');seen.add(o.characterId);return {characterId:o.characterId,outfitPrompt:validateClothing(o.outfitPrompt)};});
 return {outfits,...(includeProtagonist?{protagonistAppearance:validateAppearance(data.protagonistAppearance)}:{})};
}
export function validateCostumes(data,banner,s){
 if(!Array.isArray(data?.outfits)||data.outfits.length!==banner.characterIds.length)throw Error('선정된 캐릭터의 의상을 모두 생성해야 합니다.');
 const seen=new Set();return data.outfits.map(o=>{if(!banner.characterIds.includes(o.characterId)||seen.has(o.characterId))throw Error('의상 캐릭터 참조 오류');seen.add(o.characterId);const c=s.catalog.find(c=>c.id===o.characterId),clothingPrompt=validateClothing(o.clothingPrompt);return {id:uuid(),characterId:c.id,name:required(o.name,'의상 이름',100),clothingPrompt,compositionPrompt:'cowboy shot, detailed alternate outfit illustration',imageKey:`outfit:${banner.id}:${c.id}`};});
}
