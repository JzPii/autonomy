// Chuẩn bị mô hình cho studio, chạy hoàn toàn bằng Node (không cần Blender):
//   npm run model:prepare -- [--input=source/vf9-source.glb] [--length=5.118] [--flip] [--up=auto|y|z]
//                            [--simplify=0.5] [--min-faces=24] [--max-pieces=500] [--placeholder]
//                            [--creator=..] [--source-url=..] [--license=..] [--license-url=..]
// 1. Nướng (bake) transform, chuẩn hóa hệ tọa độ: dài dọc X (đầu xe về -X), ngang dọc Z, bánh chạm y=0, dài đúng --length mét.
// 2. Tách từng primitive thành các đảo lưới liên thông (theo vị trí đỉnh), gộp mảnh quá nhỏ.
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
const attribution=Object.assign({creator:placeholder?'Mô hình mẫu dựng bằng mã':'',source:'',license:'',licenseUrl:''},readJSON('source/attribution.json'),
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
let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
for(const s of sources){const pos=s.prim.getAttribute('POSITION').getArray();const n=pos.length/3;const p=[0,0,0];
 for(let i=0;i<n;i++){xform(s.world,pos[i*3],pos[i*3+1],pos[i*3+2],p);for(let a=0;a<3;a++){if(p[a]<lo[a])lo[a]=p[a];if(p[a]>hi[a])hi[a]=p[a]}}}
let ext=[hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]];
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
const L=ext[0],W=ext[2],H=ext[1];

// ---- Pass 2: bake, split into connected islands, classify -----------------------------------
const pieces=[];const leftovers=new Map();
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
 const text=[material?.getName(),s.mesh.getName(),s.node.getName()].filter(Boolean).join(' ').toLowerCase();
 const semantics=prim.listSemantics().map(sem=>({sem,acc:prim.getAttribute(sem)}));
 for(const triList of byRoot.values()){
  const b=triBounds(pos,idx,triList);const size=[b.hi[0]-b.lo[0],b.hi[1]-b.lo[1],b.hi[2]-b.lo[2]];
  const entry={tris:triList,bounds:b,size,center:[(b.lo[0]+b.hi[0])/2,(b.lo[1]+b.hi[1])/2,(b.lo[2]+b.hi[2])/2],faces:triList.length,source:{prim,pos,nrm,idx,semantics,material,text}};
  const tiny=Math.max(...size)<.03,smallLowPoly=triList.length<minFaces&&Math.max(...size)<.25;
  if(tiny||smallLowPoly)addLeftover(entry);else pieces.push(entry);
 }
}
// Cap the total piece count: merge the smallest islands into their material's "chi tiết nhỏ" bucket.
pieces.sort((a,b)=>score(b)-score(a));
while(pieces.length+leftovers.size>maxPieces&&pieces.length){addLeftover(pieces.pop())}
for(const lo of leftovers.values()){pieces.push(lo)}
log(`${pieces.length} mảnh (${pieces.filter(p=>p.leftover).length} nhóm chi tiết nhỏ), ${pieces.reduce((s,p)=>s+p.faces,0)} mặt`);

// ---- Build new nodes ------------------------------------------------------------------------
const entries=[];
pieces.forEach((piece,i)=>{
 const {group,label}=piece.leftover?{group:piece.group,label:'Chi tiết nhỏ'+sideSuffix(piece.center)}:classify(piece);
 const id=`${group}_${String(i).padStart(4,'0')}`;
 const primOut=slice(piece);
 const mesh=doc.createMesh(id).addPrimitive(primOut);
 const node=doc.createNode(id).setMesh(mesh).setExtras({part:group,label,component:id});scene.addChild(node);
 entries.push({id,part:group,label,center:piece.center.map(r3),size:piece.size.map(r3),faces:piece.faces});
});
for(const s of sources){s.node.dispose()}
for(const m of root.listMeshes())if(!m.listParents().some(p=>p.propertyType==='Node'))m.dispose();
await doc.transform(prune());
if(simplifyRatio!==null&&simplifyRatio>0&&simplifyRatio<1){await MeshoptSimplifier.ready;await doc.transform(weld(),simplify({simplifier:MeshoptSimplifier,ratio:simplifyRatio,error:.001}));log(`Đã giảm mặt với tỉ lệ ${simplifyRatio}`)}
// Cập nhật số mặt sau giảm
{const byId=new Map(root.listNodes().map(n=>[n.getName(),n]));for(const e of entries){const m=byId.get(e.id)?.getMesh();if(m)e.faces=m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?p.getIndices().getCount():p.getAttribute('POSITION').getCount())/3,0)}}

const file='vf9.glb';const glbPath=path.join(outDir,file);
await io.write(glbPath,doc);
const bytes=fs.readFileSync(glbPath);const version=crypto.createHash('sha1').update(bytes).digest('hex').slice(0,10);
const counts=Object.fromEntries(['body','glass','doors','cabin','wheels'].map(g=>[g,entries.filter(e=>e.part===g).length]));
fs.writeFileSync(path.join(outDir,'vf9-manifest.json'),JSON.stringify({model:'VinFast VF 9',file,version,creator:attribution.creator,source:attribution.source,license:attribution.license,licenseUrl:attribution.licenseUrl,placeholder,lengthMeters:LENGTH,generated:new Date().toISOString(),input:path.basename(input),counts,objects:entries},null,1));
log(`Ghi ${glbPath} (${(bytes.length/1e6).toFixed(1)} MB) và vf9-manifest.json — ${JSON.stringify(counts)}`);

// ---- Classification ---------------------------------------------------------------------------
function classify(piece){
 const t=piece.source.text;const m=piece.source.material;const [cx,cy,cz]=piece.center;const [sx,sy,sz]=piece.size;
 const has=(...words)=>words.some(w=>t.includes(w));
 const transparent=m&&(m.getAlphaMode()==='BLEND'||m.getAlpha()<.95||m.getBaseColorFactor()[3]<.95||m.getExtension('KHR_materials_transmission'));
 const emissive=m&&m.getEmissiveFactor().some(v=>v>.05);
 const side=Math.abs(cz),nearAxle=Math.abs(Math.abs(cx)-L*.3)<.6,low=cy<H*.33;
 const roundish=Math.abs(sy-sx)<Math.max(sx,sy)*.25&&sx>.25&&sz<sx;
 let group='body',label='Chi tiết ngoại thất';
 if(has('tire','tyre','wheel','rim','brake','disc','disk','caliper','hub','lốp','lop','bánh','banh','mâm','mam','alloy')||(low&&side>W*.3&&nearAxle&&roundish&&sx<1.1)){
  group='wheels';label=has('tire','tyre','lốp','lop')||sx>.6?'Lốp xe':has('brake','disc','disk','caliper','phanh')?'Đĩa phanh':has('rim','alloy','mâm','mam','wheel')?'Mâm xe':'Cụm bánh xe';
  return {group,label:label+sideSuffix(piece.center)+(cx<0?' · trước':' · sau')};
 }
 if(has('interior','seat','ghế','ghe','dashboard','steering','cabin','nội thất','noi that','console','carpet','pedal','floor','cockpit')||(Math.max(sx,sy,sz)<.9&&side<W*.38&&cy>H*.22&&cy<H*.8&&Math.abs(cx)<L*.3&&!transparent)){
  return {group:'cabin',label:'Nội thất'+sideSuffix(piece.center)};
 }
 if(transparent||has('glass','window','windshield','windscreen','kính','kinh','crystal')){
  group='glass';
  if(cx<-L*.12&&side<W*.25&&sz>W*.35)label='Kính chắn gió';
  else if(cx>L*.3&&sz>W*.3)label='Kính sau';
  else if(cy>H*.8&&sx>.5&&sz>W*.3)label='Kính bên / kính trần';
  else if(side>W*.3)label='Kính bên / kính trần';
  else label='Kính';
  return {group,label:label+(side>W*.3?sideSuffix(piece.center):'')};
 }
 if(emissive||has('light','lamp','led','đèn','den','headl','taill','drl','lens')){return {group:'body',label:(cx<0?'Đèn trước':'Đèn sau')+sideSuffix(piece.center)}}
 if(has('logo','badge','emblem','vinfast'))return {group:'body',label:'Logo VinFast'};
 if(has('mirror','gương','guong')||(side>W*.45&&cy>H*.5&&cy<H*.78&&Math.max(sx,sy,sz)<.45))return {group:'body',label:'Gương chiếu hậu'+sideSuffix(piece.center)};
 if(has('door','cửa','cua')||(side>W*.33&&sz<.4&&sx>.55&&sx<1.9&&sy>.45&&cy>H*.2&&cy<H*.78&&Math.abs(cx)<L*.28)){return {group:'doors',label:(cx<0?'Cửa trước':'Cửa sau')+sideSuffix(piece.center)}}
 if(cx>L*.36&&cy>H*.4&&sz>W*.4&&sx<.9)return {group:'doors',label:'Cửa cốp'};
 if(sx>L*.5&&sz>W*.6)label='Vỏ thân xe';
 else if(cx<-L*.18&&cy>H*.45&&sz>W*.4&&sx>.5&&sy<.5)label='Nắp ca-pô';
 else if(cx<-L*.36&&cy<H*.5&&sz>W*.5)label='Cản trước';
 else if(cx>L*.36&&cy<H*.5&&sz>W*.5)label='Cản sau';
 else if(cy>H*.85&&sx>1&&sz>W*.4)label='Nóc xe';
 else if(side>W*.35&&sx>.5&&sy>.3&&nearAxle)label='Tai xe / hông xe'+sideSuffix(piece.center);
 else if(cy<H*.22&&sx>1)label='Ốp gầm & chắn bùn'+sideSuffix(piece.center);
 else if(has('chrome','trim','plastic','rubber','seal','molding','ốp','op'))label=(cy<H*.3?'Ốp gầm & chắn bùn':'Ốp trang trí')+sideSuffix(piece.center);
 else label='Chi tiết ngoại thất'+sideSuffix(piece.center);
 return {group,label};
}
function sideSuffix(center){return Math.abs(center[2])>.3?(center[2]>0?' · trái':' · phải'):''}
function addLeftover(entry){
 const key=entry.source.prim;let lo=leftovers.get(key);
 if(!lo){lo=Object.assign({},entry,{tris:[],faces:0,leftover:true,bounds:{lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity]}});
  const t=entry.source.text,m=entry.source.material;const transparent=m&&(m.getAlphaMode()==='BLEND'||m.getAlpha()<.95);
  lo.group=/tire|tyre|wheel|rim|brake|lốp|mâm/.test(t)?'wheels':transparent||/glass|window|kính/.test(t)?'glass':/interior|seat|ghế/.test(t)?'cabin':'body';leftovers.set(key,lo)}
 lo.tris.push(...entry.tris);lo.faces+=entry.faces;
 for(let a=0;a<3;a++){lo.bounds.lo[a]=Math.min(lo.bounds.lo[a],entry.bounds.lo[a]);lo.bounds.hi[a]=Math.max(lo.bounds.hi[a],entry.bounds.hi[a])}
 lo.size=[0,1,2].map(a=>lo.bounds.hi[a]-lo.bounds.lo[a]);lo.center=[0,1,2].map(a=>(lo.bounds.lo[a]+lo.bounds.hi[a])/2);
}
function score(p){return Math.hypot(...p.size)*Math.log2(p.faces+2)}
// ---- Geometry slicing -------------------------------------------------------------------------
function slice(piece){
 const {pos,nrm,idx,semantics,material}=piece.source;
 const remap=new Map();const newIdx=[];
 for(const t of piece.tris)for(let k=0;k<3;k++){const v=idx[t*3+k];let n=remap.get(v);if(n===undefined){n=remap.size;remap.set(v,n)}newIdx.push(n)}
 const count=remap.size;const order=new Uint32Array(count);for(const [v,n] of remap)order[n]=v;
 const prim=doc.createPrimitive().setMode(Primitive.Mode.TRIANGLES);if(material)prim.setMaterial(material);
 for(const {sem,acc} of semantics){
  const elem=acc.getElementSize();let srcArr=acc.getArray();
  if(sem==='POSITION'){srcArr=pos}else if(sem==='NORMAL'&&nrm){srcArr=nrm}
  const arr=new srcArr.constructor(count*elem);
  for(let n=0;n<count;n++){const v=order[n];for(let e=0;e<elem;e++)arr[n*elem+e]=srcArr[v*elem+e]}
  const out=doc.createAccessor().setType(acc.getType()).setNormalized(sem==='POSITION'||sem==='NORMAL'?false:acc.getNormalized()).setArray(arr).setBuffer(buffer);
  prim.setAttribute(sem,out);
 }
 const indices=doc.createAccessor().setType('SCALAR').setArray(count>65535?new Uint32Array(newIdx):new Uint16Array(newIdx)).setBuffer(buffer);
 prim.setIndices(indices);return prim;
}
function triBounds(pos,idx,tris){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const t of tris)for(let k=0;k<3;k++){const v=idx[t*3+k];for(let a=0;a<3;a++){const c=pos[v*3+a];if(c<lo[a])lo[a]=c;if(c>hi[a])hi[a]=c}}return {lo,hi}}
function bboxUnder(M){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],p=[0,0,0];
 for(const s of sources){const T=mul(M,s.world);const pos=s.prim.getAttribute('POSITION').getArray();for(let i=0;i<pos.length;i+=3){xform(T,pos[i],pos[i+1],pos[i+2],p);for(let a=0;a<3;a++){if(p[a]<lo[a])lo[a]=p[a];if(p[a]>hi[a])hi[a]=p[a]}}}
 return {lo,hi,ext:[hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]]}}
function quarterHeights(M){let negX=-Infinity,posX=-Infinity;const p=[0,0,0];const {lo,hi}=bboxUnder(M);const q=(hi[0]-lo[0])*.25;
 for(const s of sources){const T=mul(M,s.world);const pos=s.prim.getAttribute('POSITION').getArray();for(let i=0;i<pos.length;i+=3){xform(T,pos[i],pos[i+1],pos[i+2],p);if(p[0]<lo[0]+q)negX=Math.max(negX,p[1]);else if(p[0]>hi[0]-q)posX=Math.max(posX,p[1])}}
 return {negX,posX}}
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
function findSource(){const dir='source';if(!fs.existsSync(dir))fail('Thiếu thư mục source/.');const f=fs.readdirSync(dir).find(n=>/^vf9-source\.(glb|gltf)$/.test(n))||fs.readdirSync(dir).find(n=>/\.(glb|gltf)$/.test(n)&&!n.startsWith('sample'));if(!f)fail('Không tìm thấy source/vf9-source.glb. Xem README để tải mô hình.');return path.join(dir,f)}
function readJSON(p){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return {}}}
function pick(o){return Object.fromEntries(Object.entries(o).filter(([,v])=>v!==undefined&&v!==true))}
function log(m){console.log('•',m)}
function fail(m){console.error('✗',m);process.exit(1)}
