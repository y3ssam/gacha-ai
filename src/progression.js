// Engine-owned account progression, release schedules, and cosmetic economy.
const DAY = 86400000;
export const RELEASE_PERIOD = 7 * DAY;
export const COSTUME_PERIOD = 14 * DAY;
export const COSTUME_UNLOCK = 5;
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const uid = () => crypto.randomUUID();
export function migrateProgress(s) {
  s.player ??= { xp: (s.quests?.battles||0)*60+(s.completed?.length||0)*40 };
  s.tickets ??= 0;
  s.costumeTickets ??= 0;
  s.live ??= { anchor: s.created, releases: [], auto: true, failedCycle: null };
  s.cosmetics ??= { banners: [], outfits: {}, selected: {} };
  s.generation ??= { jobs: {} };
  s.enemyCatalog ??= [];
  s.campaign ??= [];
  return s;
}
export function playerLevel(s) {
  migrateProgress(s);
  let level = 1, xp = s.player.xp;
  while (level < 100 && xp >= 100 + level * 20) { xp -= 100 + level * 20; level++; }
  return { level, xp, next: level === 100 ? 0 : 100 + level * 20 };
}
export function grantPlayerXp(s, xp) { migrateProgress(s); s.player.xp += xp;if(playerLevel(s).level>=COSTUME_UNLOCK&&Object.keys(s.owned).length>=2)ensureCostumeBanner(s); }
export function releaseCycle(s, now = Date.now()) { migrateProgress(s); return Math.max(0, Math.floor((now - s.live.anchor) / RELEASE_PERIOD)); }
export function releaseDue(s, now = Date.now()) {
  migrateProgress(s);
  if (!s.catalog.length || s.catalog.length > 297) return false;
  const cycle = releaseCycle(s, now);
  return cycle > Math.max(0, ...s.live.releases.map(r => r.cycle));
}
export function activeBanner(s, now = Date.now()) {
  migrateProgress(s);
  return s.live.releases.filter(r => r.startsAt <= now).sort((a,b) => b.cycle-a.cycle)[0]?.banner || null;
}
export function installRelease(s, draft, cycle, now = Date.now()) {
  migrateProgress(s);
  if (s.live.releases.some(r => r.cycle === cycle)) throw Error('이미 적용된 캐릭터 풀입니다.');
  if (s.catalog.length + draft.characters.length > 300) throw Error('캐릭터 도감 상한(300명)에 도달했습니다.');
  const ids = new Set(s.catalog.map(c => c.id));
  const names = new Set(s.catalog.map(c => c.name.normalize('NFKC').trim().toLowerCase()));
  for (const c of draft.characters) {
    const name = c.name.normalize('NFKC').trim().toLowerCase();
    if (ids.has(c.id) || names.has(name)) throw Error('기존 캐릭터와 중복된 생성 결과입니다.');
    ids.add(c.id); names.add(name);
  }
  if (!draft.characters.some(c => c.id === draft.banner.featuredId && c.rarity === 5)) throw Error('신규 5성 픽업이 필요합니다.');
  if(![3,4,5].every(r=>[...s.catalog,...draft.characters].some(c=>c.rarity===r&&draft.banner.poolIds.includes(c.id))))throw Error('배너에 3·4·5성 풀이 필요합니다.');
  if (!draft.banner.poolIds.every(id => ids.has(id))) throw Error('배너 캐릭터 참조 오류');
  s.catalog.push(...draft.characters);
  const chapter=s.campaign.find(c=>c.id>=s.chapter&&c.stages.some(v=>!s.stories[`${c.id}-${v.stage}`]));
  if(chapter)chapter.guestCastIds=[...new Set([...(chapter.guestCastIds||[]),...draft.characters.map(c=>c.id)])];
  s.live.releases.push({ cycle, startsAt: now, characterIds: draft.characters.map(c => c.id), banner: draft.banner });
  s.live.failedCycle = null;
  // Pity/guarantee carry over across release rotations.
}
export function costumeCycle(s, now = Date.now()) { return Math.max(0, Math.floor((now - (s.cosmetics.anchor??s.created)) / COSTUME_PERIOD)); }
export function ensureCostumeBanner(s, now = Date.now(), rng = random) {
  migrateProgress(s);
  if (playerLevel(s).level < COSTUME_UNLOCK) throw Error(`플레이어 Lv.${COSTUME_UNLOCK}에 해금됩니다.`);
  const owned = Object.keys(s.owned);
  if (owned.length < 2) throw Error('캐릭터를 2명 이상 보유해야 합니다.');
  s.cosmetics.anchor??=now;
  const cycle = costumeCycle(s, now);
  let banner = s.cosmetics.banners.find(b => b.cycle === cycle);
  if (banner) return banner;
  const pool = [...owned];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const count = Math.min(pool.length, rng() < .5 ? 2 : 3);
  const startsAt = s.cosmetics.anchor + cycle * COSTUME_PERIOD;
  banner = { id: uid(), cycle, startsAt, endsAt: startsAt + COSTUME_PERIOD, characterIds: pool.slice(0, count), outfits: [], status: 'draft', pity: 0, history: [] };
  s.cosmetics.banners.push(banner);
  return banner;
}
export function costumeReady(s, banner, now = Date.now()) {
  return banner.status === 'ready' && now >= banner.startsAt && now < banner.endsAt && banner.outfits.length === banner.characterIds.length && banner.outfits.every(o => !!s.images[o.imageKey]);
}
export function summonCostume(s, bannerId, count = 1, rng = random, now = Date.now()) {
  migrateProgress(s);
  const banner = s.cosmetics.banners.find(b => b.id === bannerId);
  if (playerLevel(s).level < COSTUME_UNLOCK || !banner || !costumeReady(s, banner, now) || ![1,10].includes(count)) throw Error('현재 소환할 수 없는 의상 풀입니다.');
  const remaining = banner.outfits.filter(o => !s.cosmetics.outfits[o.id]);
  if (!remaining.length) throw Error('이 풀의 모든 의상을 획득했습니다.');
  if(s.gems<(count-Math.min(s.costumeTickets,count))*120)throw Error('요청 횟수 전체를 실행할 성정석·의상권이 필요합니다. 완료 시 실제 횟수만 차감합니다.');
  // Plan on a draft first; insufficient funds cannot advance pity or grant rewards.
  const result = [], draft = [...remaining]; let pity = banner.pity;
  for (let i = 0; i < count && draft.length; i++) {
    pity++;
    if (rng() < .1 || pity >= 10) {
      const outfit = draft.splice(Math.floor(rng() * draft.length), 1)[0];
      result.push({ type: 'outfit', outfit }); pity = 0;
    } else {
      const roll = rng();
      result.push(roll < .55 ? {type:'gold',amount:500} : roll < .85 ? {type:'xp',amount:5} : {type:'essence',amount:2});
    }
  }
  const tickets = Math.min(s.costumeTickets, result.length), cost = (result.length - tickets) * 120;
  if (s.gems < cost) throw Error('성정석이 부족합니다.');
  s.gems -= cost; s.costumeTickets -= tickets; banner.pity = pity;
  for (const r of result) {
    if (r.type === 'outfit') s.cosmetics.outfits[r.outfit.id] = {...r.outfit, acquiredAt: now};
    else s[r.type] += r.amount;
  }
  banner.history.unshift(...result.map(r=>({type:r.type,name:r.outfit?.name,amount:r.amount,at:now}))); banner.history = banner.history.slice(0,200);
  return { results: result, cost, tickets };
}
export function selectOutfit(s, characterId, outfitId = '') {
  migrateProgress(s);
  if (!s.owned[characterId]) throw Error('보유 캐릭터만 변경할 수 있습니다.');
  if (!outfitId) { delete s.cosmetics.selected[characterId]; return; }
  const outfit = s.cosmetics.outfits[outfitId];
  if (!outfit || outfit.characterId !== characterId || !s.images[outfit.imageKey]) throw Error('획득한 일러스트만 선택할 수 있습니다.');
  s.cosmetics.selected[characterId] = outfitId;
}
export function selectedPortraitKey(s, characterId) {
  migrateProgress(s);
  return s.cosmetics.outfits[s.cosmetics.selected[characterId]]?.imageKey || `portrait:${characterId}`;
}
