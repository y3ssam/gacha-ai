// Shared browser/bridge prompt contract. Never flatten multiple people into a base caption.
export const APPEARANCE_FIELDS = {
 gender:'성별',maturity:'성숙도',skinTone:'피부색',species:'종족',bodyType:'체형',
 hairLength:'머리 길이',hairStyle:'머리 모양',bangs:'앞머리',hairColor:'머리색',
 eyeShape:'눈 모양',eyeColor:'눈색',distinctiveTraits:'고유 특징'
};
export const APPEARANCE_SCHEMA = {
 gender:'male|female|other',maturity:'English age/maturity tags consistent with profile',skinTone:'English skin color tags',species:'English species/ears/tail/horns tags',bodyType:'English height/build tags',
 hairLength:'English hair length tags, or bald',hairStyle:'English hair style/texture tags, or bald',bangs:'English bangs shape tags, or no bangs',hairColor:'English hair color tags, or bald',
 eyeShape:'English eye shape tags',eyeColor:'English eye color tags',distinctiveTraits:'English fixed visual marks distinguishing this person, or none. No clothes, pose, expression, framing or background.'
};
export const IMAGE_PLAN_SCHEMA={basePrompt:'English environment, lighting, mood, art style and framing ONLY. No character identities/appearance/clothing or subject counts.',cast:[{characterId:'exact registered id or protagonist when allowed',outfitId:'default|selected|owned outfit id',actionPrompt:'English pose, expression and action for this person ONLY',center:{x:'0.1|0.3|0.5|0.7|0.9',y:'0.1|0.3|0.5|0.7|0.9'}}]};
const words = v => typeof v==='string' ? v.trim() : '';
export function validateAppearance(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('NAI 외형 항목이 없습니다.');
 const out={};for(const key of Object.keys(APPEARANCE_FIELDS)){
   const value=words(input[key]);if(!value||value.length>400)throw Error(`NAI 외형 항목 오류: ${APPEARANCE_FIELDS[key]}`);if(/\b(coat|jacket|dress|shirt|trousers|boots|gloves|armor|robe|cape|hoodie|stockings|skirt|scarf)\b/i.test(value))throw Error('외형 항목에 의상 태그가 섞였습니다.');out[key]=value;
 }
 if(!['male','female','other'].includes(out.gender))throw Error('NAI 성별 규격 오류');
 return out;
}
export const genderTag = gender => ({male:'boy',female:'girl',other:'other'})[gender];
export function identityPrompt(appearance){
 const a=validateAppearance(appearance);
 return [genderTag(a.gender),...Object.keys(APPEARANCE_FIELDS).filter(k=>k!=='gender').map(k=>a[k]).filter(v=>!['none','not applicable'].includes(v.toLowerCase()))].join(', ');
}
export function validateClothing(value){
 const prompt=words(value);if(!prompt||prompt.length>2500)throw Error('의상 프롬프트가 없거나 너무 깁니다.');
 const tags=prompt.split(',').map(v=>v.trim());if(tags.some(tag=>/\b(hair|eyes?|skin|bangs|pupils?|body|ears?|tail|horns?)$/i.test(tag)||/^(?:\d+)?(?:boys?|girls?|others?|male|female|adult|child|teenager|young|mature male|adult woman|adult male|solo)$/i.test(tag)))throw Error('의상 프롬프트에 고정 외형 태그가 섞였습니다.');
 return prompt;
}
export function characterCaption(character,clothing=character.outfitPrompt,action=''){
 return [identityPrompt(character.naiAppearance),validateClothing(clothing),words(action)].filter(Boolean).join(', ');
}
export function hasVisualProfile(character){
 try{validateAppearance(character.naiAppearance);validateClothing(character.outfitPrompt);return true;}catch{return false;}
}
export function positionSlots(count){
 if(!Number.isInteger(count)||count<1||count>6)throw Error('한 이미지에 1~6명의 캐릭터를 지정하세요.');
 return count===1?[{x:.5,y:.5}]:count===2?[{x:.3,y:.5},{x:.7,y:.5}]:count===3?[{x:.1,y:.5},{x:.5,y:.5},{x:.9,y:.5}]:count===4?[{x:.1,y:.5},{x:.3,y:.5},{x:.7,y:.5},{x:.9,y:.5}]:count===5?[.1,.3,.5,.7,.9].map(x=>({x,y:.5})):[{x:.1,y:.3},{x:.5,y:.3},{x:.9,y:.3},{x:.1,y:.7},{x:.5,y:.7},{x:.9,y:.7}];
}
export function validateCenter(value){
 if(!value||!Number.isFinite(value.x)||!Number.isFinite(value.y)||value.x<0||value.x>1||value.y<0||value.y>1)throw Error('캐릭터 배치 좌표 오류');
 const snap=x=>Math.max(.1,Math.min(.9,Math.round((x-.1)/.2)*.2+.1));
 return {x:Number(snap(value.x).toFixed(1)),y:Number(snap(value.y).toFixed(1))};
}
export function imageCharacter(s,id){
 const c=id==='protagonist'?s.world.protagonistVisual:s.catalog.find(c=>c.id===id);
 if(!c)throw Error(`이미지 캐릭터 참조가 없습니다: ${id}`);return c;
}
function clothingFor(s,c,outfitId){
 if(!outfitId||outfitId==='default')return c.outfitPrompt;
 const id=outfitId==='selected'?s.cosmetics?.selected[c.id]:outfitId;
 if(!id)return c.outfitPrompt;
 const o=s.cosmetics?.outfits[id];
 if(!o||o.characterId!==c.id)throw Error('획득하지 않은 의상 참조');
 return o.clothingPrompt;
}
function crossNegatives(character,others){
 const own=character.naiAppearance,result=['mixed identities','fused bodies','wrong hair color','wrong eye color'];
 for(const other of others)for(const key of ['hairColor','eyeColor']){
   const value=other.naiAppearance[key],mine=own[key];
   if(value!==mine&&!mine.toLowerCase().includes(value.toLowerCase())&&!value.toLowerCase().includes(mine.toLowerCase())&&!['none','bald','not applicable'].includes(value.toLowerCase()))result.push(value);
 }
 return [...new Set(result)].join(', ');
}
export function buildImageSpec(s,basePrompt,cast=[],kind='cg'){
 if(typeof basePrompt!=='string'||!basePrompt.trim()||basePrompt.length>8000)throw Error('공통 이미지 프롬프트 오류');
 if(!Array.isArray(cast)||cast.length>6)throw Error('CG 인물은 최대 6명입니다.');
 if(['cg','portrait','banner'].includes(kind)&&!cast.length)throw Error('인물이 나오는 이미지에는 개별 캐릭터 지정이 필요합니다.');
 const ids=new Set(),positions=new Set(),fallback=cast.length?positionSlots(cast.length):[];
 const resolved=cast.map((slot,i)=>{
   if(!slot||typeof slot.characterId!=='string'||ids.has(slot.characterId))throw Error('CG 인물 ID가 없거나 중복됩니다.');ids.add(slot.characterId);
   const c=imageCharacter(s,slot.characterId);if(!hasVisualProfile(c))throw Error(`${c.name||'주인공'}의 외형·의상 프롬프트를 먼저 생성하세요.`);
   const center=validateCenter(slot.center||fallback[i]),key=`${center.x}:${center.y}`;
   if(positions.has(key))throw Error('두 캐릭터의 배치가 겹칩니다.');positions.add(key);
   const clothing=slot.clothingPrompt===undefined?clothingFor(s,c,slot.outfitId):validateClothing(slot.clothingPrompt);
   if(slot.actionPrompt!==undefined&&(typeof slot.actionPrompt!=='string'||slot.actionPrompt.length>1000))throw Error('개별 인물 행동 프롬프트 오류');
   return {c,center,clothing,action:slot.actionPrompt||''};
 });
 const globalTags=basePrompt.toLowerCase().split(',').map(v=>v.trim());
 for(const {c,clothing} of resolved){const privateTags=[...Object.values(c.naiAppearance).flatMap(v=>v.toLowerCase().split(',')),...clothing.toLowerCase().split(',')].map(v=>v.trim()).filter(v=>v.length>2&&!['none','human','other','not applicable'].includes(v));if(privateTags.some(tag=>globalTags.includes(tag)))throw Error('공통 프롬프트에 인물 외형·의상 태그가 섞였습니다. 개별 칸으로 분리하세요.');}
 const characters=resolved.map(({c,center,clothing,action})=>({characterId:c.id,prompt:characterCaption(c,clothing,action),negativePrompt:crossNegatives(c,resolved.filter(x=>x.c.id!==c.id).map(x=>x.c)),center}));
 const counts={male:0,female:0,other:0};for(const {c} of resolved)counts[c.naiAppearance.gender]++;
 const countTags=Object.entries(counts).filter(([,n])=>n).map(([g,n])=>`${n}${genderTag(g)}${n>1?'s':''}`);
 // Remove contradictory generic counts/solo; only the cast manifest sets subject count.
 const clean=basePrompt.split(',').map(t=>t.trim()).filter(t=>!/^\d+\s*(boys?|girls?|others?|people|persons?|characters?)$/i.test(t)&&!/^solo$/i.test(t)).join(', ');
 return {prompt:[...countTags,...(cast.length===1?['solo']:kind==='enemy'?['solo','single creature']:[]),clean].filter(Boolean).join(', '),kind,characters};
}
export function validateCgPlan(value,allowedIds,ownedOutfits={}){
 if(!value||typeof value.basePrompt!=='string'||!value.basePrompt.trim()||value.basePrompt.length>5000||!Array.isArray(value.cast)||!value.cast.length||value.cast.length>6)throw Error('CG 공통 프롬프트와 개별 인물 설계가 필요합니다.');
 const ids=new Set(),positions=new Set();
 const cast=value.cast.map(slot=>{
   if(!slot||!allowedIds.has(slot.characterId)||ids.has(slot.characterId)||typeof slot.actionPrompt!=='string'||slot.actionPrompt.length>1000)throw Error('CG 인물 참조·행동 오류');ids.add(slot.characterId);
   const center=validateCenter(slot.center),key=`${center.x}:${center.y}`;if(positions.has(key))throw Error('CG 인물 위치가 겹칩니다.');positions.add(key);
   if(slot.outfitId!==undefined&&typeof slot.outfitId!=='string')throw Error('CG 의상 참조 오류');if(slot.outfitId&&!['default','selected'].includes(slot.outfitId)&&ownedOutfits[slot.outfitId]?.characterId!==slot.characterId)throw Error('미획득 의상 CG 참조 오류');
   return {characterId:slot.characterId,outfitId:slot.outfitId||'default',actionPrompt:slot.actionPrompt,center};
 });
 return {basePrompt:value.basePrompt.trim(),cast};
}
// Validate payload again at the paid API boundary; keep index/center alignment for negatives.
export function normalizeCharacterPrompts(value=[]){
 if(!Array.isArray(value)||value.length>6)throw Error('개별 캐릭터 프롬프트는 최대 6개입니다.');
 const seen=new Set(),positions=new Set();
 return value.map((c,i)=>{
   if(!c||typeof c.prompt!=='string'||!c.prompt.trim()||c.prompt.length>6000||c.negativePrompt!==undefined&&(typeof c.negativePrompt!=='string'||c.negativePrompt.length>3000))throw Error('개별 캐릭터 프롬프트 형식 오류');
   const center=validateCenter(c.center),key=`${center.x}:${center.y}`;
   if(positions.has(key))throw Error('개별 캐릭터 위치 중복');positions.add(key);
   if(c.characterId){if(typeof c.characterId!=='string'||seen.has(c.characterId))throw Error('개별 캐릭터 ID 중복');seen.add(c.characterId);}
   return {prompt:c.prompt.trim(),negativePrompt:c.negativePrompt||'',center};
 });
}
