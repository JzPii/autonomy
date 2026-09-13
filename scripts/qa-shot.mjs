// QA headless: node scripts/qa-shot.mjs <url> <out.png> [waitMs=60000]
// Mở trang trong Chrome headless (WebGL phần mềm), thu console/exception, đợi mô hình tải xong, in trạng thái DOM và chụp màn hình.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
const [url,out,waitArg]=process.argv.slice(2).filter(a=>!a.startsWith('--'));const clickSel=(process.argv.find(a=>a.startsWith('--click='))||'').slice(8);const mobile=process.argv.includes('--mobile');const vw=mobile?390:1200,vh=mobile?844:760;if(!url||!out){console.error('usage: qa-shot.mjs <url> <out.png> [waitMs]');process.exit(1)}
const waitMs=Number(waitArg||60000);const port=9300+Math.floor(Math.random()*500);const profile=`/tmp/autonomy-qa-${port}`;
const chrome=process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const proc=spawn(chrome,['--headless=new','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--hide-scrollbars','--remote-allow-origins=*',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,`--window-size=${vw},${vh}`,'about:blank'],{stdio:'ignore'});
const cleanup=()=>{try{proc.kill('SIGKILL')}catch{}try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3})}catch{}};process.on('exit',cleanup);
setTimeout(()=>{console.error('qa-shot: hard timeout');cleanup();process.exit(2)},waitMs+40000).unref();
let targets;for(let i=0;i<50;i++){try{targets=await (await fetch(`http://127.0.0.1:${port}/json`)).json();if(targets.length)break}catch{}await sleep(200)}
console.error('qa: targets',targets?.length);if(!targets?.length){console.error('qa-shot: Chrome DevTools not reachable');process.exit(2)}
const target=targets.find(t=>t.type==='page')||targets[0];console.error('qa: target',target.type,target.url);const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=e=>j(new Error('ws error '+(e.message||'')))});console.error('qa: ws open');
let seq=0;const pending=new Map();const logs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}
 if(m.method==='Runtime.consoleAPICalled')logs.push(`[console.${m.params.type}] ${m.params.args.map(a=>a.value??a.description??'').join(' ')}`);
 if(m.method==='Runtime.exceptionThrown')logs.push(`[exception] ${m.params.exceptionDetails.text} ${m.params.exceptionDetails.exception?.description||''}`);
 if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')logs.push(`[${m.params.entry.source}] ${m.params.entry.text} ${m.params.entry.url||''}`)};
const send=(method,params={},timeout=25000)=>new Promise(r=>{const id=++seq;const t=setTimeout(()=>{if(pending.has(id)){pending.delete(id);console.error('qa: timeout',method);r({timeout:true})}},timeout);pending.set(id,m=>{clearTimeout(t);r(m)});ws.send(JSON.stringify({id,method,params}))});
await send('Runtime.enable');console.error('qa: runtime');await send('Log.enable');await send('Page.enable');console.error('qa: page enabled');
await send('Emulation.setDeviceMetricsOverride',{width:vw,height:vh,deviceScaleFactor:mobile?2:1,mobile});if(mobile){await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await send('Emulation.setUserAgentOverride',{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'})}
await send('Page.navigate',{url});console.error('qa: navigated');
const started=Date.now();let state;
while(Date.now()-started<waitMs){await sleep(1500);
 const r=await send('Runtime.evaluate',{returnByValue:true,expression:`JSON.stringify({markers:document.querySelectorAll('.mesh-marker').length,loading:document.querySelector('.scene-loading')?.textContent||null,error:document.querySelector('.scene-error')?.textContent||null,canvas:!!document.querySelector('canvas'),title:document.title})`});
 state=JSON.parse(r.result?.result?.value||'{}');if(state.markers>0||state.error)break}
if(clickSel){await send('Runtime.evaluate',{expression:`document.querySelector(${JSON.stringify(clickSel)})?.click()`});await sleep(800)}
await sleep(2500);
const shot=await send('Page.captureScreenshot',{format:'png'},60000);if(shot.result?.data)fs.writeFileSync(out,Buffer.from(shot.result.data,'base64'));else console.error('qa: no screenshot');
console.log(JSON.stringify({url,waited:Math.round((Date.now()-started)/1000)+'s',...state},null,0));
for(const l of logs.slice(0,25))console.log(' ',l.slice(0,300));
ws.close();cleanup();process.exit(0);
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
