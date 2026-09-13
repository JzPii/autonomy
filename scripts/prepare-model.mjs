// Chuẩn bị mô hình cho Autonomy, chạy hoàn toàn bằng Node (không cần Blender):
//   node scripts/prepare-model.mjs <id> [--simplify=0.35] [--textures=1024] [--flip] [--max-pieces=500] [--min-faces=24]
// Đọc models/<id>/model.json (kích thước, ghi công, cấu hình pipeline), nguồn trong source/<id>/.
// 1. Bake transform, chuẩn hóa hệ tọa độ: dài dọc X (đầu xe về -X), ngang dọc Z, bánh chạm y=0, dài đúng dimensions.length.
// 2. Tách từng primitive thành các đảo lưới liên thông; gộp gai lốp/nan mâm theo góc bánh; gộp mảnh li ti.
// 3. Phân loại mỗi mảnh: part (body/glass/doors/cabin/wheels/brakes/exhaust) + key nhãn trung lập ngôn ngữ (xem app/i18n/labels.ts).
// 4. Giảm mặt (meshoptimizer), nén texture (sharp → WebP), ghi public/models/<id>/model.glb, manifest.json, review.md.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {NodeIO,Primitive} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,flatten,prune,simplify,textureCompress,unpartition,weld} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';

const positional=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const args=Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('--')).map(a=>{const m=a.match(/^--([^=]+)(?:=(.*))?$/);return [m[1],m[2]??true]}));
const id=positional[0];if(!id)fail('Cách dùng: node scripts/prepare-model.mjs <id> [--simplify=0.35] [--textures=1024] [--flip]');
const modelDir=path.join('models',id);const model=readJSON(path.join(modelDir,'model.json'));if(!model.id)fail(`Thiếu models/${id}/model.json`);
const cfg=Object.assign({simplify:null,textures:1024,flip:false,maxPieces:500,minFaces:24,ignore:[],hints:[],input:null},model.pipeline||{});
if(args.simplify!==undefined)cfg.simplify=Number(args.simplify);
if(args.textures!==undefined)cfg.textures=args.textures==='none'?null:Number(args.textures);
if(args.flip)cfg.flip=!cfg.flip;
if(args['max-pieces'])cfg.maxPieces=Number(args['max-pieces']);if(args['min-faces'])cfg.minFaces=Number(args['min-faces']);
const LENGTH=model.dimensions.length;const type=model.type||'car';
const input=cfg.input?path.join('source',id,cfg.input):findSource(path.join('source',id));
const ignoreRe=cfg.ignore.length?new RegExp(cfg.ignore.join('|'),'i'):null;
const hints=cfg.hints.map(h=>({re:new RegExp(h.match,'i'),part:h.part,key:h.key}));
const outDir=path.join('public/models',id);fs.mkdirSync(outDir,{recursive:true});
log(`${model.brand} ${model.name} ← ${input}`);

const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc=await io.read(input);
await doc.transform(unpartition(),dedup(),flatten(),prune());
const root=doc.getRoot();const scene=root.getDefaultScene()||root.listScenes()[0];
const buffer=root.listBuffers()[0]||doc.createBuffer();

// ---- Pass 1: world-space bbox → canonical transform -------------------------------------------
const sources=[];
for(const node of scene.listChildren()){const mesh=node.getMesh();if(!mesh)continue;const world=node.getWorldMatrix();
 for(const prim of mesh.listPrimitives()){if(prim.getMode()!==Primitive.Mode.TRIANGLES||!prim.getAttribute('POSITION'))continue;
  const text=[prim.getMaterial()?.getName(),mesh.getName(),node.getName()].filter(Boolean).join(' ').toLowerCase();
  if(ignoreRe&&ignoreRe.test(text)){continue}
  sources.push({node,mesh,prim,world,text})}}
if(!sources.length)fail('Không có primitive tam giác nào trong mô hình.');
let {lo,hi,ext}=bboxUnder(identity());
const up=args.up&&args.up!=='auto'?args.up:(ext[1]>ext[0]&&ext[1]>ext[2]?'z':'y');
let C=identity();
if(up==='z'){C=mul(rotX(-Math.PI/2),C);log('Trục lên: Z → xoay về Y-up')}
({lo,hi,ext}=bboxUnder(C));
if(ext[2]>ext[0]){C=mul(rotY(Math.PI/2),C);log('Chiều dài dọc Z → xoay về X')}
({lo,hi,ext}=bboxUnder(C));
const scale=LENGTH/ext[0];C=mul(scaleM(scale),C);({lo,hi,ext}=bboxUnder(C));log(`Tỉ lệ ×${scale.toFixed(4)} → dài ${ext[0].toFixed(3)} m, rộng ${ext[2].toFixed(3)} m, cao ${ext[1].toFixed(3)} m`);
C=mul(translate(-(lo[0]+hi[0])/2,-lo[1],-(lo[2]+hi[2])/2),C);({lo,hi,ext}=bboxUnder(C));
// Đầu xe: ca-pô thường thấp hơn phần đuôi/kính sau → đầu thấp hơn nằm về phía -X. Ghi đè bằng pipeline.flip.
{const q=quarterHeights(C);let flip=q.negX>q.posX+.02;if(cfg.flip)flip=!flip;
 if(flip){C=mul(rotY(Math.PI),C);({lo,hi,ext}=bboxUnder(C))}
 log(`Chiều cao đỉnh 25% đầu -X: ${q.negX.toFixed(2)} m, +X: ${q.posX.toFixed(2)} m → ${flip?'đã xoay 180°':'giữ nguyên'} (đầu xe về -X${cfg.flip?', flip':''})`)}
const L=ext[0],Hm=ext[1];const H=model.dimensions.height||Hm;if(Math.abs(Hm-H)>.08)log(`Chiều cao đo ${Hm.toFixed(3)} m khác khai báo ${H.toFixed(3)} m (ăng-ten/cánh gió?) — dùng khai báo`);
const WbMeasured=bodyWidth(C);const Wb=model.dimensions.width||WbMeasured;log(`Bề ngang thân: đo ${WbMeasured.toFixed(3)} m, dùng ${Wb.toFixed(3)} m`);

// ---- Pass 2: bake + split every primitive into connected islands -------------------------------
const islands=[];
for(const s of sources){
 const T=mul(C,s.world);const R=normalMatrix(T);
 const prim=s.prim;const posAcc=prim.getAttribute('POSITION');const src=posAcc.getArray();const vcount=src.length/3;
 const pos=new Float32Array(src.length);const p=[0,0,0];
 for(let i=0;i<vcount;i++){xform(T,src[i*3],src[i*3+1],src[i*3+2],p);pos[i*3]=p[0];pos[i*3+1]=p[1];pos[i*3+2]=p[2]}
 const nrmAcc=prim.getAttribute('NORMAL');let nrm=null;
 if(nrmAcc){const sn=nrmAcc.getArray();nrm=new Float32Array(sn.length);for(let i=0;i<vcount;i++){xform3(R,sn[i*3],sn[i*3+1],sn[i*3+2],p);const l=Math.hypot(p[0],p[1],p[2])||1;nrm[i*3]=p[0]/l;nrm[i*3+1]=p[1]/l;nrm[i*3+2]=p[2]/l}}
 const idxAcc=prim.getIndices();const idx=idxAcc?idxAcc.getArray():Uint32Array.from({length:vcount},(_,i)=>i);
 const tris=idx.length/3;
 const canon=new Int32Array(vcount);const seen=new Map();
 for(let i=0;i<vcount;i++){const k=`${Math.round(pos[i*3]*1e4)},${Math.round(pos[i*3+1]*1e4)},${Math.round(pos[i*3+2]*1e4)}`;let c=seen.get(k);if(c===undefined){c=i;seen.set(k,i)}canon[i]=c}
 const parent=new Int32Array(vcount);for(let i=0;i<vcount;i++)parent[i]=i;
 const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i]}return i};
 const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[a]=b};
 for(let t=0;t<tris;t++){const a=canon[idx[t*3]],b=canon[idx[t*3+1]],c=canon[idx[t*3+2]];union(a,b);union(a,c)}
 const byRoot=new Map();
 for(let t=0;t<tris;t++){const r=find(canon[idx[t*3]]);let list=byRoot.get(r);if(!list){list=[];byRoot.set(r,list)}list.push(t)}
 const material=prim.getMaterial();
 const name=s.mesh.getName();const matName=material?.getName()||'';
 const source={prim,pos,nrm,idx,semantics:prim.listSemantics().map(sem=>({sem,acc:prim.getAttribute(sem)}))};
 for(const triList of byRoot.values()){
  const b=triBounds(pos,idx,triList);
  islands.push(withBounds({chunks:[{source,tris:triList}],faces:triList.length,text:s.text,name,matName,material},b));
 }
}
log(`${islands.length} đảo lưới từ ${sources.length} primitive, ${islands.reduce((s,i)=>s+i.faces,0)} mặt`);

// ---- Pass 3: group islands into pieces ----------------------------------------------------------
const wheelish=t=>/tire|tyre|wheel|rim\b|_rim|rim_|brake|disc|disk|caliper|lốp|lop[ _.]|bánh|banh|mâm|mam[ _.]/.test(t);
const corner=c=>type==='car'?`${c[0]<0?'F':'R'}${c[2]<0?'R':'L'}`:(c[0]<0?'F':'R');
const wheelCenters={};
for(const i of islands){if(!wheelish(i.text)||Math.max(...i.size)<.5*(LENGTH/5)||!isRound(i))continue;const k=corner(i.center);(wheelCenters[k]||=[]).push(i.center)}
const cornersAll=type==='car'?['FL','FR','RL','RR']:['F','R'];
for(const k of cornersAll){const list=wheelCenters[k];wheelCenters[k]=list?avg(list):[(k[0]==='F'?-1:1)*(model.dimensions.wheelbase||L*.6)/2,H*.21,type==='car'?(k[1]==='L'?1:-1)*(model.dimensions.track||Wb*.85)/2:0]}
{const dz=-avg(Object.values(wheelCenters))[2];
 if(Math.abs(dz)>.02){const shifted=new Set();for(const i of islands){for(const c of i.chunks){if(shifted.has(c.source))continue;shifted.add(c.source);const pos=c.source.pos;for(let k=2;k<pos.length;k+=3)pos[k]+=dz}i.bounds.lo[2]+=dz;i.bounds.hi[2]+=dz;i.center[2]+=dz}
  for(const c of Object.values(wheelCenters))c[2]+=dz;log(`Dịch ngang ${dz.toFixed(3)} m để tâm bánh đối xứng`)}}
log('Tâm bánh: '+Object.entries(wheelCenters).map(([k,c])=>`${k}(${c.map(v=>v.toFixed(2)).join(',')})`).join(' '));
const wheelR=Math.max(.25,...Object.values(wheelCenters).map(c=>c[1]));
const nearestWheel=c=>Math.min(...Object.values(wheelCenters).map(w=>Math.hypot(c[0]-w[0],c[1]-w[1],c[2]-w[2])));
const pieces=[];const wheelBuckets=new Map();const leftovers=new Map();
const leftoverKey=i=>`${i.name}|${i.matName}|${Math.round(i.center[0]/.6)}|${i.center[2]>.15?'L':i.center[2]<-.15?'R':'C'}`;
for(const i of islands){
 const maxDim=Math.max(...i.size);
 const hinted=hints.find(h=>h.re.test(i.text));
 const wheelPart=!hinted&&((wheelish(i.text)&&maxDim<wheelR*3.2)||(nearestWheel(i.center)<wheelR*1.3&&maxDim<wheelR*2.4&&!/glass|kính|kinh|light|đèn|den[ _.]|body|door|fender|paint|coat/.test(i.text)));
 if(wheelPart){merge(wheelBuckets,`${i.name}|${i.matName}|${corner(i.center)}`,i).wheel=true;continue}
 const tiny=maxDim<.08,smallLowPoly=i.faces<cfg.minFaces&&maxDim<.25;
 if(tiny||smallLowPoly){const m=merge(leftovers,leftoverKey(i),i);m.leftover=true;m.hint=hinted;continue}
 i.hint=hinted;pieces.push(i);
}
for(const w of wheelBuckets.values())pieces.push(w);
pieces.sort((a,b)=>score(b)-score(a));
while(pieces.length+leftovers.size>cfg.maxPieces&&pieces.length){const p=pieces.pop();if(p.wheel||p.leftover)continue;merge(leftovers,leftoverKey(p),p).leftover=true}
for(const lo of leftovers.values())pieces.push(lo);
log(`${pieces.length} mảnh: ${wheelBuckets.size} cụm bánh, ${leftovers.size} nhóm chi tiết nhỏ, ${pieces.length-wheelBuckets.size-leftovers.size} mảnh riêng`);

// ---- Pass 4: classify, build nodes, write ------------------------------------------------------
const entries=[];
pieces.forEach((piece,i)=>{
 const c=classify(piece);
 const pid=`${c.part}_${String(i).padStart(4,'0')}`;
 const mesh=doc.createMesh(pid).addPrimitive(slice(piece));
 const node=doc.createNode(pid).setMesh(mesh).setExtras({part:c.part,key:c.key,side:c.side||null,end:c.end||null,component:pid});scene.addChild(node);
 entries.push({id:pid,part:c.part,key:c.key,side:c.side||null,end:c.end||null,source:piece.name,material:piece.matName,center:piece.center.map(r3),size:piece.size.map(r3),faces:piece.faces});
});
for(const s of sources){s.node.dispose()}
for(const n of scene.listChildren())if(!n.getMesh()||!entries.some(e=>e.id===n.getName()))n.dispose();
for(const m of root.listMeshes())if(!m.listParents().some(p=>p.propertyType==='Node'))m.dispose();
await doc.transform(prune());
if(cfg.simplify&&cfg.simplify>0&&cfg.simplify<1){await MeshoptSimplifier.ready;await doc.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:cfg.simplify,error:.001}));log(`Đã giảm mặt với tỉ lệ ${cfg.simplify}`)}
if(cfg.textures&&root.listTextures().length){const sharp=(await import('sharp')).default;await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',resize:[cfg.textures,cfg.textures],quality:82}));log(`Đã nén ${root.listTextures().length} texture → WebP ≤${cfg.textures}px`)}
{const byId=new Map(root.listNodes().map(n=>[n.getName(),n]));for(const e of entries){const m=byId.get(e.id)?.getMesh();if(m)e.faces=m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?p.getIndices().getCount():p.getAttribute('POSITION').getCount())/3,0)}}

const file='model.glb';const glbPath=path.join(outDir,file);
await io.write(glbPath,doc);
const bytes=fs.readFileSync(glbPath);const version=crypto.createHash('sha1').update(bytes).digest('hex').slice(0,10);
const counts={};for(const e of entries)counts[e.part]=(counts[e.part]||0)+1;
fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify({id,file,version,generated:new Date().toISOString(),input:path.relative('.',input),lengthMeters:LENGTH,bounds:{length:r3(L),height:r3(H),bodyWidth:r3(Wb)},wheelCenters,counts,objects:entries},null,1));
writeReview();
log(`Ghi ${glbPath} (${(bytes.length/1e6).toFixed(1)} MB, ${entries.reduce((s,e)=>s+e.faces,0)} mặt), manifest.json, review.md — ${JSON.stringify(counts)}`);

// ---- Classification ---------------------------------------------------------------------------
function classify(piece){
 const t=piece.text;const m=piece.material;const [cx,cy,cz]=piece.center;const [sx,sy,sz]=piece.size;const maxDim=Math.max(sx,sy,sz);
 const has=(...words)=>words.some(w=>t.includes(w));
 const side=Math.abs(cz);const sideOf=()=>type==='car'&&side>.3?(cz>0?'L':'R'):null;const endOf=()=>cx<0?'F':'R';
 const transparent=m&&(m.getAlphaMode()==='BLEND'||m.getAlpha()<.95||m.getBaseColorFactor()[3]<.95||m.getExtension('KHR_materials_transmission'));
 const emissive=m&&m.getEmissiveFactor().some(v=>v>.05);
 const glassy=transparent||has('glass','window','windshield','windscreen','kính','kinh','crystal');
 const lighty=emissive||has('light','lamp','led','đèn','den ','den_','headl','taill','drl');
 const interiorish=has('interior','_int','int_','seat','upholster','ghế','ghe ','dashboard','dash','steering','cabin','nội thất','noi that','console','carpet','rug','pedal','cockpit','belt','monitor','screen','leather','wunderbaum');
 if(piece.hint)return {part:piece.hint.part||'body',key:piece.hint.key||'exterior',side:sideOf(),end:type==='car'&&piece.hint.part==='wheels'?endOf():null};
 if(piece.leftover){const part=piece.wheel?'wheels':glassy?'glass':interiorish?'cabin':'body';return {part,key:'small',side:sideOf()}}
 if(piece.wheel){
  let key,part='wheels';
  if(has('logo','badge','emblem'))key='hubcap';
  else if(has('brake','disc','disk','phanh')){part='brakes';key=has('caliper')?'caliper':'disc'}
  else if(has('caliper')){part='brakes';key='caliper'}
  else if(has('tire','tyre','lốp','lop ','lop_'))key='tire';
  else if(has('rim','alloy','mâm','mam ','mam_'))key='rim';
  else if(sx>wheelR*1.6&&isRound(piece)&&sz>wheelR*.3)key='tire';
  else if(has('wheel')||(isRound(piece)&&sx>wheelR*.9))key='rim';
  else key='wheel.part';
  return {part,key,side:sideOf(),end:endOf()};
 }
 if(has('pipe','exhaust','muffler','ống xả'))return {part:'exhaust',key:'exhaust',side:sideOf()};
 if(has('plate','number'))return {part:'body',key:'plate'};
 if(has('wiper'))return {part:'body',key:'wiper'};
 if(has('antenna','aerial'))return {part:'body',key:'antenna'};
 if(has('spoiler','wing'))return {part:'body',key:'spoiler'};
 // Khối đen lấp khoang lái của mô hình "no interior"
 if(sx>L*.5&&sz>Wb*.6&&cy>H*.2&&cy<H*.7&&piece.faces<2000)return {part:'cabin',key:'interior.block'};
 if(interiorish||(maxDim<.6&&side<Wb*.36&&cy>H*.22&&cy<H*.8&&Math.abs(cx)<L*.25&&!glassy&&!lighty)){
  let key='interior';
  if(has('upholster')&&cy>H*.75)key='headliner';else if(has('seat','upholster','ghế'))key='seat';else if(has('steering','wheel_signs'))key='steering';else if(has('belt'))key='belt';else if(has('rug','carpet'))key='carpet';
  else if(has('monitor','screen','display'))key='display';else if(has('dash'))key='dashboard';else if(has('console'))key='console';else if(has('pedal'))key='pedal';
  else if(has('carbon','chrom','plastic','pl_','trim'))key='trim.interior';else if(has('headliner','ceiling'))key='headliner';
  if(key==='interior'&&has('door'))key='trim.interior';
  return {part:'cabin',key,side:sideOf()};
 }
 if(glassy){
  let key;
  if(sx>L*.4&&sz>Wb*.45&&cy>H*.6)key='windshield.roof';
  else if(cx<-L*.05&&cx>-L*.36&&side<Wb*.2&&sz>Wb*.45&&cy>H*.55&&sx>.35)key='windshield';
  else if(cx>L*.25&&sz>Wb*.4&&cy>H*.55&&sy>.2)key='glass.rear';
  else if(Math.abs(cx)>L*.4&&sz>Wb*.4&&sy<.4)key=cx<0?'lens.front':'lens.rear';
  else if(cy>H*.85&&sx>.5&&sz>Wb*.3&&side<Wb*.2)key='glass.roof';
  else if(side>Wb*.32&&sx>.3&&sy>.2)return {part:'glass',key:'glass.side',side:sideOf(),end:endOf()};
  else if(lighty||has('light','lamp'))key=cx<0?'lens.front':'lens.rear';
  else key='glass';
  return {part:'glass',key,side:key==='glass'?sideOf():null};
 }
 if(has('reflector'))return {part:'body',key:'reflector',side:sideOf()};
 if(lighty)return {part:'body',key:cx<0?'light.front':'light.rear',side:sideOf()};
 if(has('logo','badge','emblem',model.brand.toLowerCase()))return {part:'body',key:'logo',side:side>.3?sideOf():null};
 if(has('mirror','gương','guong')||(side>Wb*.45&&cy>H*.55&&cy<H*.8&&maxDim<.45&&cx<0&&cx>-L*.25))return {part:'body',key:'mirror',side:sideOf()};
 if(has('handle')||(side>Wb*.45&&cy>H*.5&&cy<H*.7&&sx>.12&&sx<.35&&sy<.09&&sz<.08&&Math.abs(cx)<L*.26))return {part:'doors',key:'door.handle',side:sideOf(),end:endOf()};
 if(has('door','cửa','cua ')||(side>Wb*.36&&sz<.4&&sx>.55&&sx<1.9&&sy>.45&&cy>H*.25&&cy<H*.75&&Math.abs(cx)<L*.26)){
  const twoDoor=has('door_1','door_2')&&!has('door_3','door_4');
  return {part:'doors',key:twoDoor?'door':(cx<0?'door.front':'door.rear'),side:sideOf()};
 }
 if(has('hood','bonnet'))return {part:'body',key:'hood'};
 if(has('trunk','boot','tailgate'))return {part:'doors',key:cy>H*.4&&sz>Wb*.5?'tailgate':'trunk'};
 if(cx>L*.38&&cy>H*.4&&sz>Wb*.5&&sx<.9)return {part:'doors',key:'tailgate'};
 let key;
 if(sx>L*.5&&(sz>Wb*.6||sy>H*.5))return {part:'body',key:'body.shell',side:sz>Wb*.6?null:sideOf()};
 else if(cx<-L*.2&&cy>H*.5&&sz>Wb*.6&&sx>.8&&sy<.5)key='hood';
 else if(cx>L*.25&&cy>H*.5&&sz>Wb*.5&&sx>.5&&sy<.4&&sx<1.3)key='trunk';
 else if(cx<-L*.36&&cy<H*.5&&sz>Wb*.7)key='bumper.front';
 else if(cx>L*.36&&cy<H*.5&&sz>Wb*.7)key='bumper.rear';
 else if(cx<-L*.4&&sz>Wb*.45&&sy<.35)key='grille';
 else if(cy>H*.85&&sx>1&&sz>Wb*.4)key='roof';
 else if(cy>H*.85&&sx>1.2&&sz<.3)return {part:'body',key:'roof.rail',side:sideOf()};
 else if(side>Wb*.36&&sx>.5&&sy>.3&&nearestWheel(piece.center)<wheelR*2.9)return {part:'body',key:'fender',side:sideOf(),end:endOf()};
 else if(cy<H*.25&&sx>1&&sz<.35&&side>Wb*.35)return {part:'body',key:'sill',side:sideOf()};
 else if(cy<H*.22&&sx>1)return {part:'body',key:'underbody',side:sideOf()};
 else if(has('chrome','chrom','trim','plastic','rubber','seal','molding','sticker','decal','ốp','op '))return {part:'body',key:cy<H*.3?'trim.lower':'trim',side:sideOf()};
 else return {part:'body',key:'exterior',side:sideOf()};
 return {part:'body',key};
}
function isRound(p){const [sx,sy,sz]=p.size;return Math.abs(sy-sx)<Math.max(sx,sy)*.25&&sx>.2&&sz<sx}
function score(p){return Math.hypot(...p.size)*Math.log2(p.faces+2)}
function avg(list){return [0,1,2].map(a=>list.reduce((s,c)=>s+c[a],0)/list.length)}
function withBounds(entry,b){entry.bounds=b;entry.size=[0,1,2].map(a=>b.hi[a]-b.lo[a]);entry.center=[0,1,2].map(a=>(b.lo[a]+b.hi[a])/2);return entry}
function merge(map,key,entry){
 let m=map.get(key);
 if(!m){m={chunks:[],faces:0,text:entry.text,name:entry.name,matName:entry.matName,material:entry.material,bounds:{lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity]}};map.set(key,m)}
 for(const c of entry.chunks){const same=m.chunks.find(x=>x.source===c.source);if(same)same.tris=same.tris.concat(c.tris);else m.chunks.push({source:c.source,tris:c.tris.slice()})}
 m.faces+=entry.faces;
 for(let a=0;a<3;a++){m.bounds.lo[a]=Math.min(m.bounds.lo[a],entry.bounds.lo[a]);m.bounds.hi[a]=Math.max(m.bounds.hi[a],entry.bounds.hi[a])}
 return withBounds(m,m.bounds);
}
// ---- Geometry slicing (a piece may span several primitives of the same mesh) --------------------
function slice(piece){
 const semantics=piece.chunks[0].source.semantics.map(x=>x.sem).filter(sem=>piece.chunks.every(c=>c.source.semantics.some(x=>x.sem===sem)));
 const parts=[];let total=0;const newIdx=[];
 for(const {source,tris} of piece.chunks){
  const remap=new Map();
  for(const t of tris)for(let k=0;k<3;k++){const v=source.idx[t*3+k];let n=remap.get(v);if(n===undefined){n=remap.size;remap.set(v,n)}newIdx.push(total+n)}
  const order=new Uint32Array(remap.size);for(const [v,n] of remap)order[n]=v;
  parts.push({source,order});total+=remap.size;
 }
 const prim=doc.createPrimitive().setMode(Primitive.Mode.TRIANGLES);if(piece.material)prim.setMaterial(piece.material);
 for(const sem of semantics){
  const first=piece.chunks[0].source.semantics.find(x=>x.sem===sem).acc;const elem=first.getElementSize();
  const Ctor=sem==='POSITION'||sem==='NORMAL'?Float32Array:first.getArray().constructor;
  const arr=new Ctor(total*elem);let offset=0;
  for(const {source,order} of parts){
   const acc=source.semantics.find(x=>x.sem===sem).acc;
   const srcArr=sem==='POSITION'?source.pos:sem==='NORMAL'&&source.nrm?source.nrm:acc.getArray();
   for(let n=0;n<order.length;n++){const v=order[n];for(let e=0;e<elem;e++)arr[(offset+n)*elem+e]=srcArr[v*elem+e]}
   offset+=order.length;
  }
  prim.setAttribute(sem,doc.createAccessor().setType(first.getType()).setNormalized(sem==='POSITION'||sem==='NORMAL'?false:first.getNormalized()).setArray(arr).setBuffer(buffer));
 }
 prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(total>65535?new Uint32Array(newIdx):new Uint16Array(newIdx)).setBuffer(buffer));
 return prim;
}
function triBounds(pos,idx,tris){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const t of tris)for(let k=0;k<3;k++){const v=idx[t*3+k];for(let a=0;a<3;a++){const c=pos[v*3+a];if(c<lo[a])lo[a]=c;if(c>hi[a])hi[a]=c}}return {lo,hi}}
function forEachVertex(M,fn){const p=[0,0,0];for(const s of sources){const T=mul(M,s.world);const pos=s.prim.getAttribute('POSITION').getArray();for(let i=0;i<pos.length;i+=3){xform(T,pos[i],pos[i+1],pos[i+2],p);fn(p)}}}
function bboxUnder(M){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];forEachVertex(M,p=>{for(let a=0;a<3;a++){if(p[a]<lo[a])lo[a]=p[a];if(p[a]>hi[a])hi[a]=p[a]}});return {lo,hi,ext:[hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]]}}
function quarterHeights(M){let negX=-Infinity,posX=-Infinity;const {lo,hi}=bboxUnder(M);const q=(hi[0]-lo[0])*.25;forEachVertex(M,p=>{if(p[0]<lo[0]+q)negX=Math.max(negX,p[1]);else if(p[0]>hi[0]-q)posX=Math.max(posX,p[1])});return {negX,posX}}
function bodyWidth(M){let w=0;const {lo,hi}=bboxUnder(M);const y0=lo[1]+(hi[1]-lo[1])*.25,y1=lo[1]+(hi[1]-lo[1])*.5;forEachVertex(M,p=>{if(p[1]>y0&&p[1]<y1)w=Math.max(w,Math.abs(p[2]))});return w*2}
// ---- Review sheet -------------------------------------------------------------------------------
function writeReview(){
 const rows=entries.slice().sort((a,b)=>a.part.localeCompare(b.part)||a.key.localeCompare(b.key)||b.faces-a.faces);
 const lines=[`# Review — ${model.brand} ${model.name}`,'',`Input: ${path.relative('.',input)}  ·  ${entries.length} pieces  ·  ${entries.reduce((s,e)=>s+e.faces,0)} faces  ·  L ${r3(L)} m, H ${r3(H)} m, body W ${r3(Wb)} m`,'',
  'Cột: id · part · key · side/end · kích thước (m) · tâm (m) · mặt · lưới nguồn · vật liệu. Sửa nhãn sai bằng `pipeline.hints` trong model.json (match = regex trên "vật liệu tên-lưới tên-node").','',
  '| id | part | key | mod | size | center | faces | source | material |','|---|---|---|---|---|---|---|---|---|'];
 for(const e of rows)lines.push(`| ${e.id} | ${e.part} | ${e.key} | ${[e.side,e.end].filter(Boolean).join('')} | ${e.size.map(v=>v.toFixed(2)).join('×')} | ${e.center.map(v=>v.toFixed(2)).join(', ')} | ${e.faces} | ${e.source} | ${e.material} |`);
 const byKey={};for(const e of entries)byKey[`${e.part}/${e.key}`]=(byKey[`${e.part}/${e.key}`]||0)+1;
 lines.push('','## Tổng hợp','',...Object.entries(byKey).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`- ${k}: ${v}`));
 fs.writeFileSync(path.join(outDir,'review.md'),lines.join('\n')+'\n');
}
// ---- Tiny column-major mat4 helpers -------------------------------------------------------------
function identity(){return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]}
function mul(a,b){const o=Array.from({length:16},()=>0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
function rotX(t){const c=Math.cos(t),s=Math.sin(t);return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]}
function rotY(t){const c=Math.cos(t),s=Math.sin(t);return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]}
function scaleM(s){return [s,0,0,0, 0,s,0,0, 0,0,s,0, 0,0,0,1]}
function translate(x,y,z){return [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]}
function xform(M,x,y,z,o){o[0]=M[0]*x+M[4]*y+M[8]*z+M[12];o[1]=M[1]*x+M[5]*y+M[9]*z+M[13];o[2]=M[2]*x+M[6]*y+M[10]*z+M[14]}
function xform3(R,x,y,z,o){o[0]=R[0]*x+R[3]*y+R[6]*z;o[1]=R[1]*x+R[4]*y+R[7]*z;o[2]=R[2]*x+R[5]*y+R[8]*z}
function normalMatrix(M){const a=M[0],b=M[1],c=M[2],d=M[4],e=M[5],f=M[6],g=M[8],h=M[9],i=M[10];
 const A=e*i-f*h,B=f*g-d*i,Cc=d*h-e*g;const det=a*A+b*B+c*Cc||1;
 const inv=[A/det,(c*h-b*i)/det,(b*f-c*e)/det, B/det,(a*i-c*g)/det,(c*d-a*f)/det, Cc/det,(b*g-a*h)/det,(a*e-b*d)/det];
 return [inv[0],inv[3],inv[6], inv[1],inv[4],inv[7], inv[2],inv[5],inv[8]]}
function r3(v){return Math.round(v*1000)/1000}
function findSource(dir){if(!fs.existsSync(dir))fail(`Thiếu thư mục ${dir}/. Tải mô hình vào đó (xem README).`);
 const files=fs.readdirSync(dir);const f=files.find(n=>/\.(gltf|glb)$/.test(n));if(f)return path.join(dir,f);
 for(const e of fs.readdirSync(dir,{withFileTypes:true}))if(e.isDirectory()){const g=fs.readdirSync(path.join(dir,e.name)).find(n=>/\.(gltf|glb)$/.test(n));if(g)return path.join(dir,e.name,g)}
 fail(`Không tìm thấy .gltf/.glb trong ${dir}/`)}
function readJSON(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return {}}}
function log(m){console.log('•',m)}
function fail(m){console.error('✗',m);process.exit(1)}
