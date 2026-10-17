import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSign,randomBytes,timingSafeEqual} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
const PORT=Number(process.env.PORT||8787),HOST='127.0.0.1';
const pairing=randomBytes(24).toString('hex');let config={},cachedToken=null,busy=false;
const allowed=new Set([`http://127.0.0.1:${PORT}`,`http://localhost:${PORT}`,'https://y3ssam.github.io']);
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function authorized(req){const supplied=Buffer.from((req.headers.authorization||'').replace(/^Bearer /,'')),expected=Buffer.from(pairing);return supplied.length===expected.length&&timingSafeEqual(supplied,expected);}
async function body(req){let b='';for await(const part of req){b+=part;if(Buffer.byteLength(b)>2*1024*1024)throw Error('요청이 너무 큽니다.');}return JSON.parse(b||'{}');}
async function external(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(150000)});if(!r.ok){await r.body?.cancel();throw Error(`API 요청 실패 (${new URL(url).hostname}, HTTP ${r.status}). 권한·모델명·할당량을 확인하세요.`);}return r;}
export function jwtAssertion(sa,now=Math.floor(Date.now()/1000)){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const value=enc({alg:'RS256',typ:'JWT'})+'.'+enc({iss:sa.client_email,scope:'https://www.googleapis.com/auth/cloud-platform',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});const sign=createSign('RSA-SHA256');sign.update(value);return value+'.'+sign.sign(sa.private_key,'base64url');}
async function accessToken(){if(cachedToken&&cachedToken.expires>Date.now()+60000)return cachedToken.token;const sa=config.serviceAccount;if(!sa)throw Error('Vertex JSON 키를 연결하세요.');const r=await external('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwtAssertion(sa)})});const t=await r.json();if(!t.access_token)throw Error('OAuth 토큰 발급 실패');cachedToken={token:t.access_token,expires:Date.now()+t.expires_in*1000};return t.access_token;}
export function extractPng(zip){
 // Read central directory, including ZIPs using data descriptors. No files are written.
 for(let i=0;i+46<=zip.length;i++){if(zip.readUInt32LE(i)!==0x02014b50)continue;const method=zip.readUInt16LE(i+10),size=zip.readUInt32LE(i+20),outSize=zip.readUInt32LE(i+24),nameLen=zip.readUInt16LE(i+28),extra=zip.readUInt16LE(i+30),comment=zip.readUInt16LE(i+32),offset=zip.readUInt32LE(i+42);const name=zip.subarray(i+46,i+46+nameLen).toString();if(/\.(png|webp)$/i.test(name)){if(outSize>20*1024*1024||offset+30>zip.length)throw Error('이미지 크기 오류');const start=offset+30+zip.readUInt16LE(offset+26)+zip.readUInt16LE(offset+28);const compressed=zip.subarray(start,start+size);const data=method===0?compressed:method===8?inflateRawSync(compressed,{maxOutputLength:20*1024*1024}):null;if(!data)throw Error('지원하지 않는 ZIP');return {data,mime:name.endsWith('.webp')?'webp':'png'};}i+=45+nameLen+extra+comment;}throw Error('ZIP에서 이미지를 찾지 못했습니다.');
}
export function imageRequest(prompt,kind,model='nai-diffusion-4-5-full'){
 const negative='lowres, bad anatomy, text, logo, watermark, blurry';const input=`best quality, very aesthetic, detailed anime game illustration, ${prompt}`;
 const parameters={params_version:3,width:kind==='portrait'||kind==='enemy'?832:1216,height:kind==='portrait'||kind==='enemy'?1216:832,scale:5,steps:28,sampler:'k_euler_ancestral',noise_schedule:'karras',n_samples:1,seed:randomBytes(4).readUInt32LE(),negative_prompt:negative,ucPreset:0,qualityToggle:true,sm:false,sm_dyn:false};
 if(model.includes('4')){parameters.v4_prompt={caption:{base_caption:input,char_captions:[]},use_coords:false,use_order:true};parameters.v4_negative_prompt={caption:{base_caption:negative,char_captions:[]},legacy_uc:false};}return {input,model,action:'generate',parameters};
}
export function makeServer(){return http.createServer(async(req,res)=>{
 const origin=req.headers.origin;res.setHeader('Vary','Origin');
 if(origin&&!allowed.has(origin))return json(res,403,{error:'허용되지 않은 웹사이트'});
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Private-Network','true');
 if(req.headers.host!==`127.0.0.1:${PORT}`&&req.headers.host!==`localhost:${PORT}`)return json(res,403,{error:'잘못된 호스트'});
 if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
 const path=new URL(req.url,'http://localhost').pathname;
 try{
 if(path.startsWith('/api/')){
 if(!authorized(req))return json(res,401,{error:'연결 코드가 올바르지 않습니다. 로컬 프로그램의 코드를 입력하세요.'});
 if(path==='/api/health'&&req.method==='GET')return json(res,200,{vertex:!!config.serviceAccount,nai:!!config.naiToken});
 if(req.method!=='POST')return json(res,405,{error:'POST required'});
 const data=await body(req);if(typeof data.prompt==='string'&&data.prompt.length>500000)throw Error('생성 맥락이 너무 큽니다. 지침을 줄여주세요.');
 if(path==='/api/config'){
 if(busy)throw Error('생성 중에는 연결을 변경할 수 없습니다.');
 if(data.disconnect){config={};cachedToken=null;return json(res,200,{vertex:false,nai:false});}
 if(data.serviceAccount){const sa=data.serviceAccount;if(sa.type!=='service_account'||!sa.project_id||!sa.client_email||!sa.private_key?.startsWith('-----BEGIN PRIVATE KEY-----'))throw Error('서비스 계정 JSON 키 형식 오류');config.serviceAccount=sa;cachedToken=null;}
 if(data.naiToken)config.naiToken=String(data.naiToken).slice(0,4096);
 for(const [key,fallback] of [['location','global'],['model','gemini-2.5-flash'],['imageModel','nai-diffusion-4-5-full']]){let v=String(data[key]||config[key]||fallback);if(!/^[a-zA-Z0-9._-]{1,100}$/.test(v))throw Error('모델·리전 형식 오류');config[key]=v;}
 return json(res,200,{vertex:!!config.serviceAccount,nai:!!config.naiToken});}
 if(!['/api/text','/api/image'].includes(path))return json(res,404,{error:'없는 API'});
 if(busy)return json(res,409,{error:'생성 중입니다. 완료 후 다시 시도하세요.'});busy=true;
 try{
 if(path==='/api/text'){
 const token=await accessToken(),location=config.location||'global',host=location==='global'?'aiplatform.googleapis.com':`${location}-aiplatform.googleapis.com`;
 const sa=config.serviceAccount;const endpoint=`https://${host}/v1/projects/${encodeURIComponent(sa.project_id)}/locations/${location}/publishers/google/models/${config.model}:generateContent`;
 const r=await external(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:String(data.system||'').slice(0,20000)}]},contents:[{role:'user',parts:[{text:String(data.prompt||'')}]}],generationConfig:{responseMimeType:'application/json',temperature:.85,maxOutputTokens:10000}})});
 const out=await r.json();const candidate=out.candidates?.[0];if(candidate?.finishReason!=='STOP')throw Error('AI 응답이 차단되거나 길이 제한으로 중단되었습니다. 지침을 조정해 재시도하세요.');const text=candidate.content?.parts?.filter(x=>!x.thought).map(x=>x.text||'').join('');let parsed;try{parsed=JSON.parse(text);}catch{throw Error('AI가 유효한 JSON을 반환하지 않았습니다. 재시도하세요.');}return json(res,200,parsed);
 }
 if(!config.naiToken)throw Error('NAI API 토큰을 연결하세요.');if(typeof data.prompt!=='string'||data.prompt.length>8000)throw Error('이미지 프롬프트 길이 오류');
 const r=await external('https://image.novelai.net/ai/generate-image',{method:'POST',headers:{Authorization:`Bearer ${config.naiToken}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(imageRequest(data.prompt,data.kind,config.imageModel))});
 let image;if((r.headers.get('content-type')||'').includes('json')){const x=await r.json();const b64=x.images?.[0]?.image;if(!b64)throw Error('NAI 이미지 응답 오류');const bytes=Buffer.from(b64,'base64');const mime=bytes.subarray(0,4).toString()==='RIFF'?'webp':'png';image=`data:image/${mime};base64,${b64}`;}else{const x=extractPng(Buffer.from(await r.arrayBuffer()));image=`data:image/${x.mime};base64,${x.data.toString('base64')}`;}return json(res,200,{image});
 }finally{busy=false;}
 }
 if(req.method!=='GET')return json(res,405,{error:'GET required'});
 const decoded=decodeURIComponent(path);const relative=decoded==='/'?'index.html':decoded.replace(/^\//,'');
 if(!/^(index\.html|src\/[a-zA-Z0-9-]+\.(js|css)|assets\/[a-zA-Z0-9-]+\.(svg|png|webp)|favicon\.svg)$/.test(relative))return json(res,404,{error:'Not found'});
 const file=await readFile(resolve(ROOT,relative));res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[extname(relative)],'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:8787 http://localhost:8787; script-src 'self'; object-src 'none'; base-uri 'none'"});res.end(file);
 }catch(e){json(res,e.code==='ENOENT'?404:400,{error:e.code==='ENOENT'?'Not found':e.message});}
 });}
if(process.argv[1]===fileURLToPath(import.meta.url)){makeServer().listen(PORT,HOST,()=>{console.log(`\n게임: http://${HOST}:${PORT}\n연결 코드 (프로그램을 닫으면 폐기): ${pairing}\n키는 메모리에만 유지됩니다. 종료: Ctrl+C\n`);});}
