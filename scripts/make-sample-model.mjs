// Dựng một "chiếc xe" mẫu bằng hộp và trụ để kiểm thử quy trình model:prepare khi chưa có mô hình VF 9 thật.
// Cố ý dùng đơn vị cm, chiều dài dọc Z và đầu xe hướng +Z để kiểm tra bước chuẩn hóa tọa độ.
import fs from 'node:fs';
import {Document,NodeIO} from '@gltf-transform/core';
const doc=new Document();const buffer=doc.createBuffer();const scene=doc.createScene('Sample');
const mats={
 CarPaint:doc.createMaterial('CarPaint_Blue').setBaseColorFactor([.12,.28,.62,1]).setMetallicFactor(.6).setRoughnessFactor(.35),
 Glass:doc.createMaterial('Glass').setBaseColorFactor([.1,.18,.28,.4]).setAlphaMode('BLEND').setMetallicFactor(.2).setRoughnessFactor(.1),
 Tire:doc.createMaterial('Tire_Rubber').setBaseColorFactor([.03,.03,.035,1]).setRoughnessFactor(.8),
 Rim:doc.createMaterial('Rim_Alloy').setBaseColorFactor([.7,.72,.75,1]).setMetallicFactor(.95).setRoughnessFactor(.25),
 Lights:doc.createMaterial('Lights').setBaseColorFactor([.6,.7,.8,1]).setEmissiveFactor([.9,.85,.7]).setRoughnessFactor(.15),
 Chrome:doc.createMaterial('Chrome').setBaseColorFactor([.8,.82,.85,1]).setMetallicFactor(1).setRoughnessFactor(.1),
 Plastic:doc.createMaterial('BlackPlastic').setBaseColorFactor([.05,.05,.05,1]).setRoughnessFactor(.7),
};
const batches=Object.fromEntries(Object.keys(mats).map(k=>[k,{pos:[],nrm:[],idx:[]}]));
function box(k,a0,a1){const b=batches[k];const [x0,y0,z0]=a0.map((v,i)=>Math.min(v,a1[i])),[x1,y1,z1]=a0.map((v,i)=>Math.max(v,a1[i]));const faces=[
 [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1]],[[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1]],
 [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0]],[[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0]],
 [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0]],[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0]]];
 for(const [a,b2,c,d,n] of faces){const base=b.pos.length/3;b.pos.push(...a,...b2,...c,...d);b.nrm.push(...n,...n,...n,...n);b.idx.push(base,base+1,base+2,base,base+2,base+3)}}
function cylX(k,cx,cy,cz,r,hw,seg=32){const b=batches[k];const ring=(x)=>{const base=b.pos.length/3;for(let i=0;i<seg;i++){const t=i/seg*Math.PI*2;b.pos.push(x,cy+r*Math.cos(t),cz+r*Math.sin(t));b.nrm.push(0,Math.cos(t),Math.sin(t))}return base};
 const a=ring(cx-hw),c=ring(cx+hw);for(let i=0;i<seg;i++){const j=(i+1)%seg;b.idx.push(a+i,c+i,c+j,a+i,c+j,a+j)}
 for(const [x,nx] of [[cx-hw,-1],[cx+hw,1]]){const center=b.pos.length/3;b.pos.push(x,cy,cz);b.nrm.push(nx,0,0);const rb=b.pos.length/3;for(let i=0;i<seg;i++){const t=i/seg*Math.PI*2;b.pos.push(x,cy+r*Math.cos(t),cz+r*Math.sin(t));b.nrm.push(nx,0,0)}for(let i=0;i<seg;i++){const j=(i+1)%seg;if(nx>0)b.idx.push(center,rb+i,rb+j);else b.idx.push(center,rb+j,rb+i)}}}
// Kích thước VF 9 theo cm: dài 511.8, rộng 199.8, cao 169.6. Đầu xe +Z.
box('CarPaint',[-95,35,-235],[95,95,235]);                 // thân dưới
box('CarPaint',[-90,95.5,130],[90,100,230]);               // nắp ca-pô (thấp)
box('CarPaint',[-80,165,-150],[80,169.6,60]);              // nóc
box('CarPaint',[-98,25,236],[98,60,256]);                  // cản trước
box('CarPaint',[-98,25,-256],[98,60,-236]);                // cản sau
box('CarPaint',[-85,96,-236],[85,165,-230]);               // cửa cốp
for(const s of [-1,1]){
 box('CarPaint',[s*96,40,120],[s*99,100,200]);   // tai xe trước
 box('CarPaint',[s*96,40,-200],[s*99,100,-120]);           // hông sau
 box('CarPaint',[s*80,95,-150],[s*95,165,60]);             // vách bên trên
 box('CarPaint',[s*96,45,10],[s*99,160,110]);              // cửa trước
 box('CarPaint',[s*96,45,-110],[s*99,160,-10]);            // cửa sau
 box('Glass',[s*95.2,100,12],[s*95.8,160,108]);            // kính bên trước
 box('Glass',[s*95.2,100,-108],[s*95.8,160,-12]);          // kính bên sau
 box('Chrome',[s*99.5,105,100],[s*115,120,120]);           // gương
 box('Lights',[s*40,80,235.5],[s*90,95,237]);              // đèn trước
 box('Lights',[s*40,80,-237],[s*90,95,-235.5]);            // đèn sau
 for(const z of [157.5,-157.5]){cylX('Tire',s*82,38,z,38,13);cylX('Rim',s*82,38,z,27,14);cylX('Plastic',s*82,38,z,17,15.5)}
}
box('Glass',[-78,100,62],[78,164,66]);                     // kính chắn gió
box('Glass',[-78,110,-229],[78,160,-226]);                 // kính sau
box('Glass',[-60,169.7,-140],[60,170.5,50]);               // kính trần
box('Chrome',[-12,70,256.1],[12,80,258]);                  // logo
box('Plastic',[-90,30,-230],[90,34.5,230]);                // ốp gầm
for(let i=0;i<12;i++)box('Plastic',[-60+i*10,101,140+i],[-59+i*10,102,141+i]); // mảnh li ti → gộp
const mesh=doc.createMesh('SampleCar');
for(const [k,b] of Object.entries(batches)){if(!b.idx.length)continue;
 const prim=doc.createPrimitive().setMaterial(mats[k])
  .setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array(b.pos)).setBuffer(buffer))
  .setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(new Float32Array(b.nrm)).setBuffer(buffer))
  .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(b.idx)).setBuffer(buffer));
 mesh.addPrimitive(prim)}
scene.addChild(doc.createNode('Car').setMesh(mesh).setTranslation([12,-3,40]).setRotation([0,Math.sin(Math.PI/4),0,Math.cos(Math.PI/4)])); // xoay 90° + dịch để kiểm tra bake transform
fs.mkdirSync('source',{recursive:true});
await new NodeIO().write('source/sample.glb',doc);
console.log('Đã ghi source/sample.glb');
