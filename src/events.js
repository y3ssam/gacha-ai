// Engine-owned time windows, mission counters and rewards. No AI-defined economy.
export const DAY = 86400000, SEASON_LENGTH = 14 * DAY, CLAIM_GRACE = 3 * DAY;
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const dayKey = now => new Date(now).toLocaleDateString('en-CA');
export const BINGO = [
  {key:'battles',goal:3,name:'전투 3회 승리'}, {key:'pulls',goal:5,name:'캐릭터 소환 5회'}, {key:'upgrades',goal:3,name:'캐릭터 강화 3회'},
  {key:'eventWins',goal:3,name:'이벤트 던전 3회 승리'}, {key:'daily',goal:2,name:'일일 보상 2회'}, {key:'stamina',goal:100,name:'행동력 100 소비'},
  {key:'gear',goal:2,name:'장비 강화 2회'}, {key:'stories',goal:2,name:'시나리오 2화 최초 완료'}, {key:'shop',goal:3,name:'상점 구매 3회'}
];
export const BINGO_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export const PASS_MISSIONS = [
  {id:'daily-battle',scope:'daily',key:'battles',goal:3,xp:100,name:'전투 3회 승리'},
  {id:'daily-stamina',scope:'daily',key:'stamina',goal:60,xp:100,name:'행동력 60 소비'},
  {id:'daily-upgrade',scope:'daily',key:'upgrades',goal:2,xp:100,name:'캐릭터 강화 2회'},
  {id:'weekly-battle',scope:'weekly',key:'battles',goal:15,xp:300,name:'전투 15회 승리'},
  {id:'weekly-event',scope:'weekly',key:'eventWins',goal:10,xp:300,name:'이벤트 던전 10회 승리'},
  {id:'weekly-pull',scope:'weekly',key:'pulls',goal:10,xp:300,name:'캐릭터 소환 10회'},
  {id:'season-battle',scope:'season',key:'battles',goal:40,xp:500,name:'전투 40회 승리'},
  {id:'season-upgrade',scope:'season',key:'upgrades',goal:20,xp:500,name:'캐릭터 강화 20회'}
];
export const EVENT_SHOP = [
  {id:'gold',name:'골드 3,000',cost:80,limit:20,reward:{gold:3000},icon:'coin'},
  {id:'xp',name:'성장 기록 20',cost:60,limit:20,reward:{xp:20},icon:'book'},
  {id:'essence',name:'돌파 정수 10',cost:100,limit:10,reward:{essence:10},icon:'crystal'},
  {id:'gems',name:'성정석 80',cost:150,limit:8,reward:{gems:80},icon:'spark'},
  {id:'ticket',name:'캐릭터 소환권 1',cost:200,limit:5,reward:{tickets:1},icon:'star'},
  {id:'costume',name:'의상 소환권 1',cost:160,limit:5,reward:{costumeTickets:1},icon:'compass'},
  {id:'gear',name:'5성 장비 1',cost:300,limit:3,reward:{gear:1},icon:'armor'}
];
export function syncEvents(s, now = Date.now()) {
  s.events ??= { anchor:s.created, seasons:[] };
  const cycle = Math.max(0,Math.floor((now-s.events.anchor)/SEASON_LENGTH));
  let season = s.events.seasons.find(x=>x.cycle===cycle);
  if (!season) {
    const startsAt=s.events.anchor+cycle*SEASON_LENGTH;
    season={id:`season-${cycle}`,cycle,title:`시즌 ${cycle+1}`,startsAt,endsAt:startsAt+SEASON_LENGTH,claimUntil:startsAt+SEASON_LENGTH+CLAIM_GRACE,metrics:{},daily:{},weekly:{},bingo:[],lines:[],passXp:0,passClaims:[],missionClaims:[],currency:0,purchases:{},draws:0};
    s.events.seasons.push(season);
  }
  return season;
}
export function eventSeason(s,id,now=Date.now(),playing=false) {
  syncEvents(s,now); const season=s.events.seasons.find(x=>x.id===id);
  if(!season||now<season.startsAt||now>=(playing?season.endsAt:season.claimUntil)) throw Error(playing?'이벤트 진행 기간이 아닙니다.':'보상 수령·교환 기간이 종료되었습니다.');
  return season;
}
export function recordEvent(s,key,amount=1,now=Date.now()) {
  if(!['battles','pulls','upgrades','eventWins','daily','stamina','gear','stories','shop'].includes(key)||!Number.isSafeInteger(amount)||amount<0)throw Error('잘못된 이벤트 진행 값');
  const season=syncEvents(s,now);if(now<season.startsAt||now>=season.endsAt)return;
  const day=dayKey(now),week=String(Math.floor((now-season.startsAt)/(7*DAY)));
  season.metrics[key]=(season.metrics[key]||0)+amount;
  season.daily[day]??={};season.daily[day][key]=(season.daily[day][key]||0)+amount;
  season.weekly[week]??={};season.weekly[week][key]=(season.weekly[week][key]||0)+amount;
}
function grant(s,season,reward) {
  for(const [key,value] of Object.entries(reward)) {
    if(key==='currency')season.currency+=value;
    else if(key==='gear')s.equipment.push({id:crypto.randomUUID(),slot:['weapon','armor','charm'][season.cycle%3],rarity:5,level:0,sourceLevel:1});
    else s[key]=(s[key]||0)+value;
  }
}
export function claimBingo(s,id,index,now=Date.now()) {
  if(!Number.isInteger(index)||index<0||index>=9)throw Error('잘못된 빙고 칸');
  const season=eventSeason(s,id,now),mission=BINGO[index];
  if(!mission||season.bingo.includes(index)||(season.metrics[mission.key]||0)<mission.goal)throw Error('빙고 미션 보상을 받을 수 없습니다.');
  season.bingo.push(index);grant(s,season,{currency:40,gold:500});
}
export function bingoLineReady(season,index) { return BINGO_LINES[index]?.every(i=>(season.metrics[BINGO[i].key]||0)>=BINGO[i].goal); }
export function claimBingoLine(s,id,index,now=Date.now()) {
  if(!Number.isInteger(index)||index<0||index>=8)throw Error('잘못된 빙고 줄');
  const season=eventSeason(s,id,now);
  if(!bingoLineReady(season,index)||season.lines.includes(index))throw Error('빙고 줄 보상을 받을 수 없습니다.');
  season.lines.push(index);grant(s,season,{gems:80,currency:100});
}
export function passMissions(season,now=Date.now()) {
  // Include unclaimed completed past daily/weekly missions during the claim grace.
  const day=dayKey(Math.min(now,season.endsAt-1)),week=String(Math.floor((Math.min(now,season.endsAt-1)-season.startsAt)/(7*DAY)));
  return PASS_MISSIONS.flatMap(m=>{
    const periods=m.scope==='daily'?[...new Set([day,...Object.keys(season.daily)])]:m.scope==='weekly'?[...new Set([week,...Object.keys(season.weekly)])]:['season'];
    return periods.map(period=>{const value=(m.scope==='daily'?season.daily[period]:m.scope==='weekly'?season.weekly[period]:season.metrics)?.[m.key]||0;return {...m,period,claimKey:`${m.id}:${period}`,value};}).filter(v=>v.period===(m.scope==='daily'?day:m.scope==='weekly'?week:'season')||v.value>=m.goal&&!season.missionClaims.includes(v.claimKey));
  });
}
export function claimPassMission(s,id,key,now=Date.now()) {
  const season=eventSeason(s,id,now),mission=passMissions(season,now).find(x=>x.claimKey===key);
  if(!mission||season.missionClaims.includes(key)||mission.value<mission.goal)throw Error('패스 미션 보상을 받을 수 없습니다.');
  season.missionClaims.push(key);season.passXp+=mission.xp;
}
export function passReward(level) {
  if(!Number.isInteger(level)||level<1||level>20)throw Error('잘못된 패스 레벨');
  return level%10===0?{gems:160,costumeTickets:2}:level%5===0?{tickets:1,currency:100}:level%2===0?{xp:20,essence:5}:{gold:2000,currency:50};
}
export function claimPassLevel(s,id,level,now=Date.now()) {
  const season=eventSeason(s,id,now);
  if(level>Math.min(20,Math.floor(season.passXp/100))||season.passClaims.includes(level))throw Error('패스 레벨 보상을 받을 수 없습니다.');
  const reward=passReward(level);season.passClaims.push(level);grant(s,season,reward);
}
export function eventExchange(s,id,offerId,now=Date.now()) {
  const season=eventSeason(s,id,now),offer=EVENT_SHOP.find(x=>x.id===offerId);
  if(!offer||season.currency<offer.cost||(season.purchases[offerId]||0)>=offer.limit)throw Error('이벤트 재화 또는 교환 잔여 수량이 부족합니다.');
  season.currency-=offer.cost;season.purchases[offerId]=(season.purchases[offerId]||0)+1;grant(s,season,offer.reward);
}
export function eventLottery(s,id,count=1,rng=random,now=Date.now()) {
  const season=eventSeason(s,id,now);
  if(![1,10].includes(count)||season.currency<50*count)throw Error('이벤트 재화가 부족합니다.');
  const results=[];
  for(let i=0;i<count;i++){const roll=rng();results.push(roll<.45?{gold:1500}:roll<.7?{xp:10}:roll<.85?{essence:3}:roll<.95?{gems:80}:{tickets:1});}
  season.currency-=50*count;season.draws+=count;for(const reward of results)grant(s,season,reward);return results;
}
export function eventBattleReward(s,battle,now=Date.now()) {
  if(!battle.eventId)return 0;
  const season=s.events?.seasons.find(x=>x.id===battle.eventId);
  if(!season||now<season.startsAt||now>=season.endsAt)return 0;
  const amount=60*(battle.eventTier||1);season.currency+=amount;recordEvent(s,'eventWins',1,now);return amount;
}
