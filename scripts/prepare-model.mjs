// Chuẩn bị mô hình cho studio, chạy hoàn toàn bằng Node (không cần Blender):
//   npm run model:prepare -- [--input=source/vf9-source.glb] [--length=5.118] [--flip] [--up=auto|y|z]
//                            [--simplify=0.35] [--min-faces=24] [--max-pieces=500] [--placeholder]
//                            [--creator=..] [--source-url=..] [--license=..] [--license-url=..]
// 1. Nướng (bake) transform, chuẩn hóa hệ tọa độ: dài dọc X (đầu xe về -X), ngang dọc Z, bánh chạm y=0, dài đúng --length mét.
// 2. Tách từng primitive thành các đảo lưới liên thông (theo vị trí đỉnh); gộp gai lốp/nan mâm theo góc bánh, gộp mảnh li ti.
// 3. Phân loại mỗi mảnh vào hệ thống (body/glass/doors/cabin/wheels) và gán nhãn tiếng Việt.
// 4. (Tùy chọn) giảm số mặt bằng meshoptimizer; ghi public/models/vf9.glb + vf9-manifest.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {NodeIO,Primitive} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,flatten,prune,simplify,unpartition,weld} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';

const args=Object.fromEntries(process.argv.slice(2).map(a=>{const m=a.match(/^--([^=]+)(?:=(.*))?$/);return m?[m[1],m[2]??true]:[a,true]}));
const input=args.input||findSource();
const LENGTH=Number(args.length||5.118);
const minFaces=Number(args['min-faces']||24),maxPieces=Number(args['max-pieces']||500);
const simplifyRatio=args.simplify===undefined?null:Number(args.simplify);
const placeholder=Boolean(args.placeholder);
const attribution=Object.assign({creator:placeholder?'Mô hình mẫu dựng bằng mã':'',source:'',license:'',licenseUrl:''},placeholder?{}:readJSON('source/attribution.json'),
 pick({creator:args.creator,source:args['source-url'],license:args.license,licenseUrl:args['license-url']}));
const outDir='public/models';fs.mkdirSync(outDir,{recursive:true});

const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc=await io.read(input);
await doc.transform(unpartition(),dedup(),flatten(),prune());
const root=doc.getRoot();const scene=root.getDefaultScene()||root.listScenes()[0];
const buffer=root.listBuffers()[0]||doc.createBuffer();

// ---- Pass 1: world-space bbox → canonical transform -------------------------------------------
const sources=[];
for(const node of scene.listChildren()){const mesh=node.getMesh();if(!mesh)continue;const world=node.getWorldMatrix();
 for(const prim of mesh.listPrimitives()){if(prim.getMode()!==Primitive.Mode.TRIANGLES||!prim.getAttribute('POSITION'))continue;sources.push({node,mesh,prim,world})}}
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
// Đầu xe: SUV có ca-pô thấp hơn cửa cốp → đầu thấp hơn nằm về phía -X.
{const q=quarterHeights(C);let flip=q.negX>q.posX+.02;if(args.flip)flip=!flip;
 if(flip){C=mul(rotY(Math.PI),C);({lo,hi,ext}=bboxUnder(C))}
 log(`Chiều cao đỉnh 25% đầu -X: ${q.negX.toFixed(2)} m, +X: ${q.posX.toFixed(2)} m → ${flip?'đã xoay 180°':'giữ nguyên'} (đầu xe về -X${args.flip?', --flip':''})`)}
const L=ext[0],H=ext[1];
const Wb=bodyWidth(C);log(`Bề ngang thân (không gương) ≈ ${Wb.toFixed(3)} m`);

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
 // union-find on quantised positions so split normals / UV seams do not break a panel apart
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
 const text=[matName,name,s.node.getName()].filter(Boolean).join(' ').toLowerCase();
 const source={prim,pos,nrm,idx,semantics:prim.listSemantics().map(sem=>({sem,acc:prim.getAttribute(sem)}))};
 for(const triList of byRoot.values()){
  const b=triBounds(pos,idx,triList);
  islands.push(withBounds({chunks:[{source,tris:triList}],faces:triList.length,text,name,matName,material},b));
 }
}
log(`${islands.length} đảo lưới từ ${sources.length} primitive, ${islands.reduce((s,i)=>s+i.faces,0)} mặt`);

// ---- Pass 3: group islands into pieces ----------------------------------------------------------
const wheelish=t=>/tire|tyre|wheel|rim\b|brake|disc|disk|caliper|lốp|lop[ _.]|bánh|banh|mâm|mam[ _.]/.test(t);
const corner=c=>`${c[0]<0?'F':'R'}${c[2]<0?'R':'L'}`;
// Tâm bánh xe: từ các đảo tròn lớn có vật liệu lốp/mâm; nếu không có thì ước lượng theo cơ sở ~61% chiều dài.
const wheelCenters={};
for(const i of islands){if(!wheelish(i.text)||Math.max(...i.size)<.55||!isRound(i))continue;const k=corner(i.center);(wheelCenters[k]||=[]).push(i.center)}
for(const k of ['FL','FR','RL','RR']){const list=wheelCenters[k];wheelCenters[k]=list?avg(list):[(k[0]==='F'?-1:1)*L*.305,H*.21,(k[1]==='L'?1:-1)*Wb*.43]}
log('Tâm bánh: '+Object.entries(wheelCenters).map(([k,c])=>`${k}(${c.map(v=>v.toFixed(2)).join(',')})`).join(' '));
const nearestWheel=c=>Math.min(...Object.values(wheelCenters).map(w=>Math.hypot(c[0]-w[0],c[1]-w[1],c[2]-w[2])));
const pieces=[];const wheelBuckets=new Map();const leftovers=new Map();
for(const i of islands){
 const maxDim=Math.max(...i.size);
 const wheelPart=(wheelish(i.text)&&maxDim<1.3)||(nearestWheel(i.center)<.5&&maxDim<.95&&!/glass|kính|kinh|light|đèn|den[ _.]/.test(i.text));
 if(wheelPart){merge(wheelBuckets,`${i.name}|${i.matName}|${corner(i.center)}`,i).wheel=true;continue}
 const tiny=maxDim<.08,smallLowPoly=i.faces<minFaces&&maxDim<.25;
 if(tiny||smallLowPoly){merge(leftovers,`${i.name}|${i.matName}`,i).leftover=true;continue}
 pieces.push(i);
}
for(const w of wheelBuckets.values())pieces.push(w);
// Cap the total piece count: merge the smallest islands into their material's "chi tiết nhỏ" bucket.
pieces.sort((a,b)=>score(b)-score(a));
while(pieces.length+leftovers.size>maxPieces&&pieces.length){const p=pieces.pop();if(p.wheel||p.leftover)continue;merge(leftovers,`${p.name}|${p.matName}`,p).leftover=true}
for(const lo of leftovers.values())pieces.push(lo);
log(`${pieces.length} mảnh: ${wheelBuckets.size} cụm bánh, ${leftovers.size} nhóm chi tiết nhỏ, ${pieces.length-wheelBuckets.size-leftovers.size} mảnh riêng`);

// ---- Pass 4: classify, build nodes, write ------------------------------------------------------
const entries=[];
pieces.forEach((piece,i)=>{
 const {group,label}=classify(piece);
 const id=`${group}_${String(i).padStart(4,'0')}`;
 const mesh=doc.createMesh(id).addPrimitive(slice(piece));
 const node=doc.createNode(id).setMesh(mesh).setExtras({part:group,label,component:id});scene.addChild(node);
 entries.push({id,part:group,label,source:piece.name,center:piece.center.map(r3),size:piece.size.map(r3),faces:piece.faces});
});
for(const s of sources){s.node.dispose()}
for(const m of root.listMeshes())if(!m.listParents().some(p=>p.propertyType==='Node'))m.dispose();
await doc.transform(prune());
if(simplifyRatio!==null&&simplifyRatio>0&&simplifyRatio<1){await MeshoptSimplifier.ready;await doc.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:simplifyRatio,error:.001}));log(`Đã giảm mặt với tỉ lệ ${simplifyRatio}`)}
{const byId=new Map(root.listNodes().map(n=>[n.getName(),n]));for(const e of entries){const m=byId.get(e.id)?.getMesh();if(m)e.faces=m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?p.getIndices().getCount():p.getAttribute('POSITION').getCount())/3,0)}}

const file='vf9.glb';const glbPath=path.join(outDir,file);
await io.write(glbPath,doc);
const bytes=fs.readFileSync(glbPath);const version=crypto.createHash('sha1').update(bytes).digest('hex').slice(0,10);
const counts=Object.fromEntries(['body','glass','doors','cabin','wheels'].map(g=>[g,entries.filter(e=>e.part===g).length]));
fs.writeFileSync(path.join(outDir,'vf9-manifest.json'),JSON.stringify({model:'VinFast VF 9',file,version,creator:attribution.creator,source:attribution.source,license:attribution.license,licenseUrl:attribution.licenseUrl,placeholder,lengthMeters:LENGTH,generated:new Date().toISOString(),input:path.basename(input),counts,objects:entries},null,1));
log(`Ghi ${glbPath} (${(bytes.length/1e6).toFixed(1)} MB, ${entries.reduce((s,e)=>s+e.faces,0)} mặt) và vf9-manifest.json — ${JSON.stringify(counts)}`);

// ---- Classification ---------------------------------------------------------------------------
function classify(piece){
 const t=piece.text;const m=piece.material;const [cx,cy,cz]=piece.center;const [sx,sy,sz]=piece.size;const maxDim=Math.max(sx,sy,sz);
 const has=(...words)=>words.some(w=>t.includes(w));
 const side=Math.abs(cz),sideSfx=sideSuffix(piece.center),endSfx=cx<0?' · trước':' · sau';
 const transparent=m&&(m.getAlphaMode()==='BLEND'||m.getAlpha()<.95||m.getBaseColorFactor()[3]<.95||m.getExtension('KHR_materials_transmission'));
 const emissive=m&&m.getEmissiveFactor().some(v=>v>.05);
 const glassy=transparent||has('glass','window','windshield','windscreen','kính','kinh','crystal');
 const lighty=emissive||has('light','lamp','led','đèn','den ','den_','headl','taill','drl','lens');
 if(piece.leftover){const g=piece.wheel?'wheels':glassy?'glass':has('interior','seat','ghế')?'cabin':'body';return {group:g,label:'Chi tiết nhỏ'+sideSfx}}
 if(piece.wheel){
  const label=has('logo','badge','emblem')?'Nắp tâm mâm':has('tire','tyre','lốp','lop ','lop_')||(sx>.7&&isRound(piece))?'Lốp xe':has('brake','disc','disk','caliper','phanh')?'Đĩa phanh':has('rim','alloy','mâm','mam ','mam_','wheel')||(isRound(piece)&&sx>.38)?'Mâm xe':'Chi tiết bánh xe';
  return {group:'wheels',label:label+sideSfx+endSfx};
 }
 // Khối đen lấp khoang lái của mô hình "no interior"
 if(sx>L*.5&&sz>Wb*.6&&cy>H*.2&&cy<H*.7&&piece.faces<2000)return {group:'cabin',label:'Khối che nội thất'};
 if(has('interior','seat','ghế','ghe ','dashboard','steering','cabin','nội thất','noi that','console','carpet','pedal','cockpit')||(maxDim<.6&&side<Wb*.36&&cy>H*.22&&cy<H*.8&&Math.abs(cx)<L*.25&&!glassy&&!lighty)){
  return {group:'cabin',label:'Nội thất'+sideSfx};
 }
 if(glassy){
  let label;
  if(sx>L*.4&&sz>Wb*.45&&cy>H*.6)label='Kính chắn gió & kính trần';
  else if(cx<-L*.05&&cx>-L*.36&&side<Wb*.2&&sz>Wb*.45&&cy>H*.55&&sx>.35)label='Kính chắn gió';
  else if(cx>L*.3&&sz>Wb*.45&&cy>H*.6&&sy>.25)label='Kính sau';
  else if(Math.abs(cx)>L*.4&&sz>Wb*.4&&sy<.4)label=cx<0?'Kính đèn trước':'Kính đèn sau';
  else if(cy>H*.85&&sx>.5&&sz>Wb*.3&&side<Wb*.2)label='Kính trần';
  else if(side>Wb*.32&&sx>.3&&sy>.2)label='Kính bên'+sideSfx+endSfx;
  else label='Kính'+sideSfx;
  return {group:'glass',label};
 }
 if(lighty)return {group:'body',label:(cx<0?'Đèn trước':'Đèn sau')+sideSfx};
 if(has('logo','badge','emblem','vinfast'))return {group:'body',label:'Logo VinFast'+(side>.3?sideSfx:'')};
 if(side>Wb*.45&&cy>H*.5&&cy<H*.7&&sx>.12&&sx<.35&&sy<.09&&sz<.08&&Math.abs(cx)<L*.26)return {group:'doors',label:'Tay nắm cửa'+sideSfx+(cx<0?' · trước':' · sau')};
 if(has('mirror','gương','guong')||(side>Wb*.45&&cy>H*.55&&cy<H*.8&&maxDim<.45&&cx<0&&cx>-L*.25))return {group:'body',label:'Gương chiếu hậu'+sideSfx};
 if(has('door','cửa','cua ')||(side>Wb*.36&&sz<.4&&sx>.55&&sx<1.9&&sy>.45&&cy>H*.25&&cy<H*.75&&Math.abs(cx)<L*.26)){return {group:'doors',label:(cx<0?'Cửa trước':'Cửa sau')+sideSfx}}
 if(cx>L*.38&&cy>H*.4&&sz>Wb*.5&&sx<.9)return {group:'doors',label:'Cửa cốp'};
 let label;
 if(cx<-L*.2&&cy>H*.5&&sz>Wb*.6&&sx>.8&&sy<.5)label='Nắp ca-pô';
 else if(cx<-L*.36&&cy<H*.5&&sz>Wb*.7)label='Cản trước';
 else if(cx>L*.36&&cy<H*.5&&sz>Wb*.7)label='Cản sau';
 else if(cx<-L*.4&&sz>Wb*.45&&sy<.35)label='Lưới tản nhiệt / ốp đầu xe';
 else if(cy>H*.85&&sx>1&&sz>Wb*.4)label='Nóc xe';
 else if(cy>H*.85&&sx>1.2&&sz<.3)label='Thanh nóc'+sideSfx;
 else if(side>Wb*.36&&sx>.5&&sy>.3&&nearestWheel(piece.center)<1.1)label='Tai xe / hông xe'+sideSfx+endSfx;
 else if(cy<H*.25&&sx>1&&sz<.35&&side>Wb*.35)label='Ốp bậc cửa'+sideSfx;
 else if(cy<H*.22&&sx>1)label='Ốp gầm & chắn bùn'+sideSfx;
 else if(has('chrome','trim','plastic','rubber','seal','molding','ốp','op '))label=(cy<H*.3?'Ốp gầm & chắn bùn':'Ốp trang trí')+sideSfx;
 else label='Chi tiết ngoại thất'+sideSfx;
 return {group:'body',label};
}
function sideSuffix(center){return Math.abs(center[2])>.3?(center[2]>0?' · trái':' · phải'):''}
function isRound(p){const [sx,sy,sz]=p.size;return Math.abs(sy-sx)<Math.max(sx,sy)*.25&&sx>.25&&sz<sx}
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
// ---- Tiny column-major mat4 helpers -------------------------------------------------------------
function identity(){return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]}
function mul(a,b){const o=Array.from({length:16},()=>0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
function rotX(t){const c=Math.cos(t),s=Math.sin(t);return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]}
function rotY(t){const c=Math.cos(t),s=Math.sin(t);return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]}
function scaleM(s){return [s,0,0,0, 0,s,0,0, 0,0,s,0, 0,0,0,1]}
function translate(x,y,z){return [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]}
function xform(M,x,y,z,o){o[0]=M[0]*x+M[4]*y+M[8]*z+M[12];o[1]=M[1]*x+M[5]*y+M[9]*z+M[13];o[2]=M[2]*x+M[6]*y+M[10]*z+M[14]}
function xform3(R,x,y,z,o){o[0]=R[0]*x+R[3]*y+R[6]*z;o[1]=R[1]*x+R[4]*y+R[7]*z;o[2]=R[2]*x+R[5]*y+R[8]*z}
function normalMatrix(M){// inverse-transpose of upper-left 3x3
 const a=M[0],b=M[1],c=M[2],d=M[4],e=M[5],f=M[6],g=M[8],h=M[9],i=M[10];
 const A=e*i-f*h,B=f*g-d*i,Cc=d*h-e*g;const det=a*A+b*B+c*Cc||1;
 const inv=[A/det,(c*h-b*i)/det,(b*f-c*e)/det, B/det,(a*i-c*g)/det,(c*d-a*f)/det, Cc/det,(b*g-a*h)/det,(a*e-b*d)/det];
 return [inv[0],inv[3],inv[6], inv[1],inv[4],inv[7], inv[2],inv[5],inv[8]]}
function r3(v){return Math.round(v*1000)/1000}
function findSource(){const dir='source';if(!fs.existsSync(dir))fail('Thiếu thư mục source/.');
 const direct=fs.readdirSync(dir).find(n=>/^vf9-source\.(glb|gltf)$/.test(n));if(direct)return path.join(dir,direct);
 for(const e of fs.readdirSync(dir,{withFileTypes:true}))if(e.isDirectory()){const f=fs.readdirSync(path.join(dir,e.name)).find(n=>/\.(gltf|glb)$/.test(n));if(f)return path.join(dir,e.name,f)}
 const any=fs.readdirSync(dir).find(n=>/\.(glb|gltf)$/.test(n)&&!n.startsWith('sample'));if(any)return path.join(dir,any);
 fail('Không tìm thấy mô hình trong source/. Xem README để tải.')}
function readJSON(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return {}}}
function pick(o){return Object.fromEntries(Object.entries(o).filter(([,v])=>v!==undefined&&v!==true))}
function log(m){console.log('•',m)}
function fail(m){console.error('✗',m);process.exit(1)}
