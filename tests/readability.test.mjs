import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
const colors=Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map(m=>[m[1],m[2]]));
function luminance(hex){
 const c=hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return .2126*c[0]+.7152*c[1]+.0722*c[2];
}
function contrast(a,b){const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05);}
test('normal/secondary/accent text and main actions meet 4.5:1 contrast on opaque UI surfaces',()=>{
 for(const foreground of ['ink','muted','teal'])for(const background of ['surface-main','surface-sidebar','surface-active','surface-hover']){
  const ratio=contrast(colors[foreground],colors[background]);assert.ok(ratio>=4.5,`${foreground}/${background}: ${ratio}`);
 }
 assert.ok(contrast(colors['action-ink'],colors.action)>=4.5);
});
