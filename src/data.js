export const ROLES = {striker:'공격',guardian:'수호',healer:'치유',support:'지원'};
export const ELEMENTS = {fire:'화염',water:'빙결',wind:'질풍',light:'광휘',dark:'암흑'};
export const SKILLS = {
 strike:{name:'집중 타격',icon:'sword',target:'enemy',power:2.15,cooldown:2},
 sweep:{name:'섬광 파동',icon:'spark',target:'allEnemies',power:1.15,cooldown:3},
 mend:{name:'생명의 흐름',icon:'leaf',target:'ally',power:2.5,cooldown:2},
 ward:{name:'결계 전개',icon:'shield',target:'allAllies',power:0.8,cooldown:3},
 weaken:{name:'균열 각인',icon:'eye',target:'enemy',power:1.35,cooldown:3},
 rally:{name:'공명 증폭',icon:'star',target:'allAllies',power:0.2,cooldown:3}
};
export const ROLE_SKILL={striker:'strike',guardian:'ward',healer:'mend',support:'rally'};
export const STARTERS=[
{id:'ael',name:'아엘',rarity:5,role:'guardian',element:'light',portrait:0,profile:'관측소의 경계를 지키는 기사. 무너진 궤도의 신호를 추적한다.',appearance:'adult male, silver hair, blue eyes, white black gold knight coat',skill:'ward'},
{id:'sena',name:'세나',rarity:4,role:'striker',element:'water',portrait:1,profile:'별의 파편으로 마법을 짜는 연구자. 침묵 속에서도 가능성을 읽는다.',appearance:'adult woman, long dark blue hair, turquoise eyes, navy mage coat',skill:'sweep'},
{id:'rin',name:'린',rarity:4,role:'striker',element:'fire',portrait:2,profile:'구름 아래 폐허를 누비는 정찰대원. 길이 없다면 직접 만든다.',appearance:'adult woman, red hair, amber eyes, dark ranger coat, mechanical bow',skill:'strike'},
{id:'noah',name:'노아',rarity:3,role:'healer',element:'wind',portrait:3,profile:'떠돌이 의사. 잃어버린 항로에서 돌아오지 못한 사람들을 기다린다.',appearance:'adult male, blond hair, glasses, white medical coat',skill:'mend'}
];
export const DEFAULT_WORLD={title:'경계의 관측소',lore:'하늘의 항로가 끊긴 후, 부유하는 도시들은 고립되었다. 관측소에 도착한 당신은 사라진 별들의 신호를 따라 동료와 함께 항로를 복원한다.',protagonist:'신호를 읽을 수 있는 신임 관측자',imagePrompt:'floating observatory, blue planet, orbital ruins, atmospheric anime background, no text'};
export const DIRECTIVES={overall:'',world:'',gacha:'',scene:'',chapters:'',cg:'',characterStory:''};
export const EQUIPMENT={weapon:{name:'궤도검',icon:'sword',stat:'atk',base:18},armor:{name:'관측자 외투',icon:'armor',stat:'def',base:12},charm:{name:'공명 나침반',icon:'compass',stat:'hp',base:90}};
export const CHAPTERS=Array.from({length:12},(_,i)=>({id:i+1,title:['끊어진 신호','구름 아래의 도시','침묵의 항로','파편의 기억','경계의 불꽃','역행하는 별','길 잃은 함대','새벽의 균열','심연의 관측자','마지막 궤도','돌아오는 이름','다시 열린 하늘'][i],level:1+i*4}));
export const DUNGEONS=[{id:'gold',name:'침묵의 금고',reward:'gold',icon:'coin',description:'골드 집중 획득'},{id:'xp',name:'기억의 회랑',reward:'xp',icon:'book',description:'성장 재료 집중 획득'},{id:'gear',name:'궤도 공방',reward:'gear',icon:'armor',description:'장비 획득'},{id:'ascend',name:'별의 심층',reward:'ascend',icon:'crystal',description:'돌파·각성 재료 획득'}];
export const ENEMY_ARCHETYPES = {
 skirmisher:{hp:.8,atk:1.05,def:.8,speed:115,skill:'strike'},
 brute:{hp:1.45,atk:1.05,def:1.2,speed:65,skill:'strike'},
 caster:{hp:.85,atk:.8,def:.8,speed:95,skill:'sweep'},
 warden:{hp:1.2,atk:.75,def:1.4,speed:80,skill:'ward'}
};
