import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {loadGLB} from './lib/load-glb.mjs';
const id=process.argv[2];if(!id){console.error('usage: validate-model.mjs <id>');process.exit(1)}
const dir=`public/models/${id}`;const model=JSON.parse(fs.readFileSync(`models/${id}/model.json`,'utf8'));
const manifest=JSON.parse(fs.readFileSync(`${dir}/manifest.json`,'utf8'));
const {asset,bytes}=await loadGLB(`${dir}/${manifest.file}`);
const known=['body','glass','doors','cabin','wheels','brakes','exhaust','engine'];
const ids=new Set();let meshes=0;asset.scene.updateMatrixWorld(true);
asset.scene.traverse(o=>{if(o.userData.component){ids.add(o.userData.component);assert.equal(o.userData.component,o.name);assert(known.includes(o.userData.part),`Unknown part ${o.userData.part}`);assert(typeof o.userData.key==='string'&&o.userData.key.length>0)}if(o.isMesh){meshes++;assert(o.geometry.attributes.position.count>0);}});
assert(manifest.objects.length>0,'Manifest has no pieces');
assert.equal(ids.size,manifest.objects.length,'GLB piece count differs from manifest');
assert(manifest.objects.every(p=>ids.has(p.id)&&known.includes(p.part)&&p.faces>0));
const box=new THREE.Box3().setFromObject(asset.scene);const size=box.getSize(new THREE.Vector3());
const L=model.dimensions.length;
assert(Math.abs(size.x-L)/L<.03,`Length ${size.x.toFixed(3)} m differs from ${L} m`);
assert(size.z>L*.28&&size.z<L*.6,`Unexpected width ${size.z}`);assert(size.y>L*.18&&size.y<L*.5,`Unexpected height ${size.y}`);
assert(Math.abs(box.min.y)<.05,`Wheels should rest on y=0, got ${box.min.y}`);
for(const lang of ['vi','en']){const c=JSON.parse(fs.readFileSync(`models/${id}/content.${lang}.json`,'utf8'));assert(c.systems.length>0);for(const s of c.systems){assert(s.id&&s.name&&s.description&&s.principle&&Array.isArray(s.specs)&&Array.isArray(s.explode)&&Array.isArray(s.anchor),`content.${lang} system ${s.id} incomplete`)}}
console.log(JSON.stringify({id,meshPieces:ids.size,drawMeshes:meshes,size:size.toArray().map(v=>+v.toFixed(3)),mb:+(bytes.length/1e6).toFixed(1),counts:manifest.counts},null,2));
