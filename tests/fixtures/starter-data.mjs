import {identityPrompt} from '../../src/image-prompts.js';
export const STARTERS=[
{id:'ael',name:'아엘',rarity:5,role:'guardian',element:'light',portrait:0,profile:'관측소의 경계를 지키는 기사. 무너진 궤도의 신호를 추적한다.',appearance:'adult male, silver hair, blue eyes, white black gold knight coat',skill:'ward'},
{id:'sena',name:'세나',rarity:4,role:'striker',element:'water',portrait:1,profile:'별의 파편으로 마법을 짜는 연구자. 침묵 속에서도 가능성을 읽는다.',appearance:'adult woman, long dark blue hair, turquoise eyes, navy mage coat',skill:'sweep'},
{id:'rin',name:'린',rarity:4,role:'striker',element:'fire',portrait:2,profile:'구름 아래 폐허를 누비는 정찰대원. 길이 없다면 직접 만든다.',appearance:'adult woman, red hair, amber eyes, dark ranger coat, mechanical bow',skill:'strike'},
{id:'noah',name:'노아',rarity:3,role:'healer',element:'wind',portrait:3,profile:'떠돌이 의사. 잃어버린 항로에서 돌아오지 못한 사람들을 기다린다.',appearance:'adult male, blond hair, glasses, white medical coat',skill:'mend'}
];
const starterVisuals=[
 {naiAppearance:{gender:'male',maturity:'adult, mature male',skinTone:'fair skin',species:'human',bodyType:'tall, broad shoulders',hairLength:'short hair',hairStyle:'layered hair, swept-back hair',bangs:'side-swept bangs',hairColor:'silver hair',eyeShape:'sharp eyes, narrow eyes',eyeColor:'blue eyes',distinctiveTraits:'defined jawline'},outfitPrompt:'white and black tailored knight coat, gold trim, black gloves, sword'},
 {naiAppearance:{gender:'female',maturity:'adult woman',skinTone:'pale skin',species:'human',bodyType:'tall, slender build',hairLength:'long hair',hairStyle:'straight hair',bangs:'parted bangs',hairColor:'dark blue hair',eyeShape:'almond-shaped eyes',eyeColor:'turquoise eyes',distinctiveTraits:'beauty mark under left eye'},outfitPrompt:'navy ceremonial mage coat, silver embroidery, blue crystal pendant'},
 {naiAppearance:{gender:'female',maturity:'adult woman',skinTone:'light tan skin',species:'human',bodyType:'athletic build',hairLength:'long hair',hairStyle:'high ponytail, wavy hair',bangs:'messy bangs',hairColor:'red hair',eyeShape:'upturned eyes',eyeColor:'amber eyes',distinctiveTraits:'freckles'},outfitPrompt:'dark leather ranger coat, red scarf, utility belt, mechanical bow'},
 {naiAppearance:{gender:'male',maturity:'adult male',skinTone:'fair skin',species:'human',bodyType:'slender build',hairLength:'short hair',hairStyle:'slightly wavy hair',bangs:'curtain bangs',hairColor:'blond hair',eyeShape:'gentle drooping eyes',eyeColor:'green eyes',distinctiveTraits:'round spectacles'},outfitPrompt:'white medical coat, dark high-collared shirt, green medical pouch'}
];
STARTERS.forEach((c,i)=>Object.assign(c,starterVisuals[i],{identityPrompt:identityPrompt(starterVisuals[i].naiAppearance),visualProfileVersion:2}));
export const DEFAULT_WORLD={title:'경계의 관측소',lore:'하늘의 항로가 끊긴 후, 부유하는 도시들은 고립되었다. 관측소에 도착한 당신은 사라진 별들의 신호를 따라 동료와 함께 항로를 복원한다.',protagonist:'신호를 읽을 수 있는 신임 관측자',imagePrompt:'floating observatory, blue planet, orbital ruins, atmospheric anime background, no text'};
