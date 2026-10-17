import test from 'node:test';
import assert from 'node:assert/strict';
import {frameMetrics,installViewport} from '../src/viewport.js';
import {portraitMarkup} from '../src/portraits.js';

test('1600×900 stage fits desktop, short windows and portrait/landscape phones without stretching',()=>{
 for(const [w,h] of [[1920,1080],[1600,900],[1366,768],[1920,720],[844,390],[390,844],[0,0]]){
  const frame=frameMetrics(w,h);
  assert.ok(frame.width<=w&&frame.height<=h);
  assert.equal(frame.width,1600*frame.scale);assert.equal(frame.height,900*frame.scale);
  assert.ok(frame.scale<=1);
 }
 assert.deepEqual(frameMetrics(1920,1080),{scale:1,width:1600,height:900});
 assert.deepEqual(frameMetrics(800,450),{scale:.5,width:800,height:450});
 assert.equal(frameMetrics(1920,720).scale,.8);
});
test('viewport resize updates both stage scale and native dialog/backdrop measurements',()=>{
 const oldDocument=globalThis.document,oldWindow=globalThis.window;
 const values=new Map(),listeners={};
 globalThis.document={documentElement:{style:{setProperty:(k,v)=>values.set(k,v)}}};
 globalThis.window={innerWidth:1600,innerHeight:900,addEventListener:(k,fn)=>listeners[k]=fn,visualViewport:{width:800,height:450,addEventListener:(k,fn)=>listeners['visual:'+k]=fn}};
 try{
  installViewport();assert.equal(values.get('--game-scale'),'0.5');
  assert.equal(values.get('--frame-width'),'800px');assert.equal(values.get('--frame-height'),'450px');
  window.visualViewport.width=1200;window.visualViewport.height=675;listeners['visual:resize']();
  assert.equal(values.get('--game-scale'),'0.75');assert.equal(values.get('--frame-height'),'675px');
  assert.equal(typeof listeners.resize,'function');
 }finally{globalThis.document=oldDocument;globalThis.window=oldWindow;}
});
test('each starter portrait crops exactly one atlas cell with native aspect ratio',()=>{
 for(let i=0;i<4;i++){
  const html=portraitMarkup({name:'동료',portrait:i});
  assert.match(html,/viewBox="0 0 443.5 887"/);
  assert.match(html,/preserveAspectRatio="xMidYMin meet"/);
  assert.ok(html.includes(`x="${-443.5*i}"`));
  assert.ok(!html.includes('background-size'));
 }
});
test('generated portrait uses selected image without atlas scaling and escapes content',()=>{
 const html=portraitMarkup({name:'<동료>"',portrait:2},'data:image/png;base64,YQ==','home-portrait');
 assert.match(html,/<img class="portrait-media"/);assert.ok(!html.includes('<svg'));
 assert.match(html,/aria-label="&lt;동료&gt;&quot;"/);
 assert.match(portraitMarkup({name:'안전',portrait:999},'javascript:alert(1)'),/x="-1330.5"/);
});
