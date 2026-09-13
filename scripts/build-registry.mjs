// Gom models/*/model.json thành public/registry.json, chép nội dung song ngữ vào public/models/<id>/,
// và sinh web/<id>/index.html để mỗi phương tiện có URL riêng trên máy chủ tĩnh.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const modelsDir=path.join(root,'models');
const ids=fs.readdirSync(modelsDir,{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(modelsDir,e.name,'model.json'))).map(e=>e.name).sort();
const template=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const registry=[];
for(const id of ids){
 const dir=path.join(modelsDir,id);const model=JSON.parse(fs.readFileSync(path.join(dir,'model.json'),'utf8'));
 const out=path.join(root,'public/models',id);fs.mkdirSync(out,{recursive:true});
 for(const f of ['model.json','content.vi.json','content.en.json','internals.json'])if(fs.existsSync(path.join(dir,f)))fs.copyFileSync(path.join(dir,f),path.join(out,f));
 const manifestPath=path.join(out,'manifest.json');const manifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):null;
 registry.push({id,brand:model.brand,name:model.name,type:model.type,year:model.year,tagline:model.tagline,powertrain:model.powertrain,pieces:manifest?manifest.objects.length:0,ready:Boolean(manifest),thumbnail:fs.existsSync(path.join(out,'thumb.jpg'))?`/models/${id}/thumb.jpg`:null,creator:model.attribution?.creator||''});
 // per-vehicle entry page: same app, vehicle-specific metadata
 const title=`${model.brand} ${model.name} — Autonomy`;
 const desc=`${model.tagline?.en||''} / ${model.tagline?.vi||''}`.trim();
 const html=template.replace(/<title>[^<]*<\/title>/,`<title>${title}</title>`).replace(/(<meta name="description" content=")[^"]*(")/,`$1${desc.replace(/"/g,'&quot;')}$2`).replace('src="/main.tsx"','src="../main.tsx"');
 fs.mkdirSync(path.join(root,'web',id),{recursive:true});fs.writeFileSync(path.join(root,'web',id,'index.html'),html);
}
// remove stale generated pages
for(const e of fs.readdirSync(path.join(root,'web'),{withFileTypes:true}))if(e.isDirectory()&&!ids.includes(e.name))fs.rmSync(path.join(root,'web',e.name),{recursive:true,force:true});
fs.mkdirSync(path.join(root,'public'),{recursive:true});
fs.writeFileSync(path.join(root,'public/registry.json'),JSON.stringify({generated:new Date().toISOString(),vehicles:registry},null,1));
console.log(`registry: ${registry.map(r=>`${r.id}${r.ready?'':' (no model yet)'}`).join(', ')}`);
