export const GAME_WIDTH=1600, GAME_HEIGHT=900;
// A single scale controls the stage, top-layer dialog and its frame-only backdrop.
export function frameMetrics(width,height){
 const scale=Math.max(0,Math.min(1,Math.max(0,width)/GAME_WIDTH,Math.max(0,height)/GAME_HEIGHT));
 return {scale,width:GAME_WIDTH*scale,height:GAME_HEIGHT*scale};
}
export function installViewport(){
 if(!globalThis.document?.documentElement?.style)return;
 const fit=()=>{
  const viewport=window.visualViewport;
  const {scale,width,height}=frameMetrics(viewport?.width||window.innerWidth,viewport?.height||window.innerHeight);
  const style=document.documentElement.style;
  style.setProperty('--game-scale',String(scale));
  style.setProperty('--frame-width',`${width}px`);
  style.setProperty('--frame-height',`${height}px`);
 };
 fit();window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);
}
