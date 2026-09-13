// Đọc GLB trong Node bằng Three GLTFLoader, bỏ texture/ảnh (Node không có Image/canvas) để chỉ kiểm tra hình học và metadata.
import fs from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
export function stripTextures(bytes){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(dv.getUint32(0,true)!==0x46546C67)throw new Error('Not a GLB');
 const jsonLen=dv.getUint32(12,true);const json=JSON.parse(Buffer.from(bytes.buffer,bytes.byteOffset+20,jsonLen).toString('utf8'));
 const binStart=20+jsonLen;const binLen=dv.getUint32(binStart,true);const bin=bytes.subarray(binStart+8,binStart+8+binLen);
 delete json.images;delete json.textures;delete json.samplers;
 for(const m of json.materials||[]){const pbr=m.pbrMetallicRoughness||{};delete pbr.baseColorTexture;delete pbr.metallicRoughnessTexture;delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;
  for(const ext of Object.values(m.extensions||{}))for(const k of Object.keys(ext))if(k.endsWith('Texture'))delete ext[k]}
 json.extensionsUsed=(json.extensionsUsed||[]).filter(e=>!/texture/i.test(e));json.extensionsRequired=(json.extensionsRequired||[]).filter(e=>!/texture/i.test(e));
 let js=Buffer.from(JSON.stringify(json));while(js.length%4)js=Buffer.concat([js,Buffer.from(' ')]);
 const binPad=(4-bin.length%4)%4;const total=12+8+js.length+8+bin.length+binPad;
 const out=Buffer.alloc(total);const o=new DataView(out.buffer,out.byteOffset,out.byteLength);
 o.setUint32(0,0x46546C67,true);o.setUint32(4,2,true);o.setUint32(8,total,true);o.setUint32(12,js.length,true);o.setUint32(16,0x4E4F534A,true);js.copy(out,20);
 o.setUint32(20+js.length,bin.length+binPad,true);o.setUint32(24+js.length,0x004E4942,true);Buffer.from(bin).copy(out,28+js.length);
 return out;
}
export async function loadGLB(path){const raw=fs.readFileSync(path);const bytes=stripTextures(raw);const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');return {asset,bytes:raw}}
