// Tải mô hình từ Sketchfab (cần token API cá nhân: https://sketchfab.com/settings/password).
//   SKETCHFAB_TOKEN=xxxx npm run model:download [-- <model uid>]
// Ghi source/vf9-source.glb và source/attribution.json để npm run model:prepare dùng.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';

const uid=process.argv[2]||'cac6cb95b9084d0abee37dccb46fa10b'; // "Vinfast VF9 model (no interior)" – Giang Trần, CC BY 4.0
const token=process.env.SKETCHFAB_TOKEN||readTokenFile();
if(!token){console.error('Thiếu SKETCHFAB_TOKEN. Lấy token tại https://sketchfab.com/settings/password rồi chạy lại.\nHoặc tải thủ công (định dạng glTF) và đặt vào source/vf9-source.glb.');process.exit(1)}
const headers={Authorization:`Token ${token}`};
const meta=await (await fetch(`https://api.sketchfab.com/v3/models/${uid}`)).json();
const links=await (await fetch(`https://api.sketchfab.com/v3/models/${uid}/download`,{headers})).json();
const pick=links.glb||links.gltf; if(!pick?.url){console.error('Mô hình không cho phép tải hoặc token không hợp lệ:',JSON.stringify(links));process.exit(1)}
fs.mkdirSync('source',{recursive:true});
const archive=path.join('source',`${uid}.${links.glb?'glb':'zip'}`);
fs.writeFileSync(archive,Buffer.from(await (await fetch(pick.url)).arrayBuffer()));
const glb='source/vf9-source.glb';
if(links.glb){fs.renameSync(archive,glb)}
else{
 const dir=path.join('source',uid);fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir);
 execFileSync('unzip',['-o','-q',archive,'-d',dir]);
 const gltf=walk(dir).find(f=>f.endsWith('.gltf')||f.endsWith('.glb'));
 if(!gltf){console.error('Không tìm thấy .gltf trong gói tải về');process.exit(1)}
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
 await io.write(glb,await io.read(gltf));
}
fs.writeFileSync('source/attribution.json',JSON.stringify({name:meta.name,creator:meta.user?.displayName||meta.user?.username,source:meta.viewerUrl||`https://sketchfab.com/3d-models/${uid}`,license:meta.license?.label||'',licenseUrl:meta.license?.url||'',faces:meta.faceCount,vertices:meta.vertexCount},null,2));
console.log(`Đã tải ${meta.name} (${meta.faceCount} mặt) → ${glb}`);
function readTokenFile(){try{return fs.readFileSync(path.join(process.env.HOME||'',' .config/sketchfab/token'.trim()),'utf8').trim()}catch{return ''}}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
