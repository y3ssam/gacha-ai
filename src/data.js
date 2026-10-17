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
export const DIRECTIVES={overall:'',world:'',gacha:'',scene:'',chapters:'',cg:'',characterStory:''};
export const EQUIPMENT={weapon:{name:'무기',icon:'sword',image:'assets/reference/equipment/pathfinder-weapon.png',stat:'atk',base:18},armor:{name:'갑옷',icon:'armor',image:'assets/reference/equipment/pathfinder-armor.png',stat:'def',base:12},charm:{name:'장신구',icon:'compass',image:'assets/reference/equipment/pathfinder-ring.png',stat:'hp',base:90}};
export const CHAPTERS=Array.from({length:12},(_,i)=>({id:i+1,title:`제 ${i+1}장`,level:1+i*4}));
export const DUNGEONS=[{id:'gold',name:'골드 던전',reward:'gold',icon:'coin',description:'골드 집중 획득'},{id:'xp',name:'성장 던전',reward:'xp',icon:'book',description:'성장 재료 집중 획득'},{id:'gear',name:'장비 던전',reward:'gear',icon:'armor',description:'장비 획득'},{id:'ascend',name:'돌파 던전',reward:'ascend',icon:'crystal',description:'돌파·각성 재료 획득'}];
export const ENEMY_ARCHETYPES = {
 skirmisher:{hp:.8,atk:1.05,def:.8,speed:115,skill:'strike'},
 brute:{hp:1.45,atk:1.05,def:1.2,speed:65,skill:'strike'},
 caster:{hp:.85,atk:.8,def:.8,speed:95,skill:'sweep'},
 warden:{hp:1.2,atk:.75,def:1.4,speed:80,skill:'ward'}
};
