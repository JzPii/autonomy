// Tải mô hình từ Sketchfab (cần token API cá nhân: https://sketchfab.com/settings/password).
//   SKETCHFAB_TOKEN=xxxx node scripts/download-source.mjs <id> <sketchfab uid>
// Giải nén vào source/<id>/ và ghi source/<id>/attribution.json (tham khảo khi điền models/<id>/model.json).
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const [id,uid]=process.argv.slice(2);if(!id||!uid){console.error('usage: download-source.mjs <id> <sketchfab uid>');process.exit(1)}
const token=process.env.SKETCHFAB_TOKEN||readTokenFile();
if(!token){console.error('Thiếu SKETCHFAB_TOKEN. Lấy token tại https://sketchfab.com/settings/password rồi chạy lại.\nHoặc tải thủ công (định dạng glTF) và đặt vào source/vf9-source.glb.');process.exit(1)}
const headers={Authorization:`Token ${token}`};
const meta=await (await fetch(`https://api.sketchfab.com/v3/models/${uid}`)).json();
const links=await (await fetch(`https://api.sketchfab.com/v3/models/${uid}/download`,{headers})).json();
const pick=links.glb||links.gltf; if(!pick?.url){console.error('Mô hình không cho phép tải hoặc token không hợp lệ:',JSON.stringify(links));process.exit(1)}
const dir=path.join('source',id);fs.mkdirSync(dir,{recursive:true});
const archive=path.join(dir,`${uid}.${links.glb?'glb':'zip'}`);
fs.writeFileSync(archive,Buffer.from(await (await fetch(pick.url)).arrayBuffer()));
if(links.glb){fs.renameSync(archive,path.join(dir,'scene.glb'))}
else{execFileSync('unzip',['-o','-q',archive,'-d',dir]);fs.rmSync(archive);if(!walk(dir).some(f=>/\.(gltf|glb)$/.test(f))){console.error('Không tìm thấy .gltf trong gói tải về');process.exit(1)}}
fs.writeFileSync(path.join(dir,'attribution.json'),JSON.stringify({name:meta.name,creator:meta.user?.displayName||meta.user?.username,source:meta.viewerUrl||`https://sketchfab.com/3d-models/${uid}`,license:meta.license?.label||'',licenseUrl:meta.license?.url||'',faces:meta.faceCount,vertices:meta.vertexCount},null,2));
console.log(`Đã tải ${meta.name} (${meta.faceCount} mặt) → ${dir}/`);
function readTokenFile(){try{return fs.readFileSync(path.join(process.env.HOME||'',' .config/sketchfab/token'.trim()),'utf8').trim()}catch{return ''}}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
