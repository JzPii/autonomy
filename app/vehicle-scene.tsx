import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {createExplosionLayout,layoutCenter,overviewDirection} from './explosion-layout';
import {PointerTap} from './pointer-tap';
import {UI,type Lang} from './i18n/ui';
import {pieceLabel} from './labels';
import {systemFor,url,variantFile,type Quality,type Shape,type Vehicle} from './registry';
export type SceneHandle={zoom:(factor:number)=>void;reset:()=>void};
type Props={vehicle:Vehicle;lang:Lang;quality:Quality;focusedMesh:string;onInspect:(id:string)=>void;selected:string;explode:number;labels:boolean;autoRotate:boolean;isolated:boolean;hiddenIds:string;onSelect:(id:string)=>void};
// Hệ tọa độ: chiều dài xe dọc trục X (đầu xe về -X), bề ngang dọc trục Z, Y hướng lên. scripts/prepare-model.mjs chuẩn hóa GLB về hệ này.
const VehicleScene=forwardRef<SceneHandle,Props>(function VehicleScene(props,ref){
 const host=useRef<HTMLDivElement>(null);const latest=useRef(props);latest.current=props;
 const engine=useRef<{camera:THREE.PerspectiveCamera;controls:OrbitControls;reset:()=>void;interrupt:()=>void}|null>(null);
 const [error,setError]=useState<string|null>(null);const [ready,setReady]=useState(false);const [progress,setProgress]=useState(0);
 const labelRefs=useRef<{systems:{b:HTMLButtonElement;id:string}[];pieces:{b:HTMLButtonElement;id:string;index:number}[]}>({systems:[],pieces:[]});
 useEffect(()=>{const {vehicle:v,lang:l}=latest.current;const T=UI[l];const byId=new Map(v.manifest.objects.map(p=>[p.id,p]));
  for(const {b,id} of labelRefs.current.systems){const s=v.content.systems.find(x=>x.id===id);if(s){b.setAttribute('aria-label',T.inspect(s.name));b.querySelector('strong')!.textContent=s.name}}
  for(const {b,id,index} of labelRefs.current.pieces){const p=byId.get(id);const label=p?pieceLabel(p,l,v):T.unknownPiece;b.title=label;b.setAttribute('aria-label',T.inspectPiece(index+1,label))}
 },[props.lang,props.vehicle]);
 useImperativeHandle(ref,()=>({zoom(f){const e=engine.current;if(e){e.interrupt();e.camera.position.sub(e.controls.target).multiplyScalar(f).add(e.controls.target)}},reset(){const e=engine.current;if(e){e.reset()}}}),[]);
 const {vehicle}=props;const modelUrl=url(`models/${vehicle.meta.id}/${variantFile(vehicle.manifest,props.quality)}?v=${vehicle.manifest.version}`);
 const t=UI[props.lang];
 useEffect(()=>{
  setReady(false);setError(null);setProgress(0);
  const el=host.current!; let renderer:THREE.WebGLRenderer;
  const T=UI[latest.current.lang];
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'})}catch{setError(T.webglFail);return}
  const systems=vehicle.content.systems;const dims=vehicle.meta.dimensions;const L=dims.length;const S=L/5.1; // scale relative to the SUV the layout was tuned on
  const illustrative=new Set(systems.filter(s=>s.illustrative).map(s=>s.id));
  const offsets=Object.fromEntries(systems.map(s=>[s.id,s.explode||[0,0,0]])) as Record<string,[number,number,number]>;
  const anchors=Object.fromEntries(systems.map(s=>[s.id,s.anchor||[0,dims.height*.6,0]])) as Record<string,[number,number,number]>;
  // Độ nét: 0–10% tách rời render tới 2× DPR (xe nguyên khối, ít vật thể); trên 10% hạ về 1,5× (desktop) / 1,25× (cảm ứng)
  // để Safari trên điện thoại không hết bộ nhớ khi bung hàng trăm chi tiết; khung hình chậm liên tục còn hạ thêm.
  const coarse=window.matchMedia('(pointer: coarse)').matches;const dpr=window.devicePixelRatio||1;
  let qualityCap=2;let pixelRatio=0;let slowFrames=0;
  const applyPixelRatio=(explode:number)=>{const want=Math.min(dpr,explode<=10?qualityCap:Math.min(qualityCap,coarse?1.25:1.5));if(Math.abs(want-pixelRatio)>.01){pixelRatio=want;renderer.setPixelRatio(pixelRatio);renderer.setSize(el.clientWidth||1,el.clientHeight||1)}};
  applyPixelRatio(latest.current.explode);
  const adaptQuality=(dt:number,busy:boolean)=>{if(!busy){slowFrames=0;return}if(dt>.045)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);if(slowFrames>24&&qualityCap>1){qualityCap=Math.max(1,qualityCap-.25);slowFrames=0;pixelRatio=0;applyPixelRatio(latest.current.explode)}};
  renderer.setClearColor(0x000000,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;el.appendChild(renderer.domElement);
  const BG='#f5f2ed';const scene=new THREE.Scene();scene.background=new THREE.Color(BG);scene.fog=new THREE.Fog(BG,16*S,55*S);const camera=new THREE.PerspectiveCamera(37,1,.05,500);camera.position.set(-5.7*S,2.9*S,6.3*S);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,dims.height*.47,0);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=5*S;controls.maxDistance=180;controls.maxPolarAngle=Math.PI*.49;controls.minPolarAngle=.18;controls.enablePan=true;controls.autoRotateSpeed=.65;engine.current={camera,controls,reset:()=>{fitView(true);invalidated=true},interrupt:()=>{framingTime=0}};
  const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();const env=pmrem.fromScene(room,.04);scene.environment=env.texture;
  scene.add(new THREE.HemisphereLight(0xffffff,0xd9d2c6,.9));
  const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(-4,8,4);scene.add(key);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-7*S;key.shadow.camera.right=7*S;key.shadow.camera.top=7*S;key.shadow.camera.bottom=-7*S;key.shadow.bias=-.001;
  const rim=new THREE.DirectionalLight(0xbfd3e6,1.2);rim.position.set(3,4,-5);scene.add(rim);
  const glow=new THREE.PointLight(0xffe2c4,1.2,10);glow.position.set(1,0,4);scene.add(glow);
  const groups={} as Record<string,THREE.Group>;systems.forEach(p=>{const g=new THREE.Group();g.name=p.id;g.userData.part=p.id;groups[p.id]=g;scene.add(g)});
  // ---- Nội tạng minh họa dựng từ dữ liệu internals.json ----
  const mat=(color:string,metal=.3,rough=.32)=>new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough});
  const palette:Record<string,THREE.MeshStandardMaterial>={dark:mat('#13181d',.28,.36),silver:mat('#94a2ae',.85,.25),orange:mat('#f97645',.55,.32),module:mat('#6d827e',.65,.38),copper:mat('#b87333',.8,.3)};
  function addShape(g:THREE.Group,geometry:THREE.BufferGeometry,m:THREE.Material,pos:[number,number,number],rot?:[number,number,number]){const o=new THREE.Mesh(geometry,m.clone());o.position.set(...pos);if(rot)o.rotation.set(...rot);o.castShadow=true;o.receiveShadow=true;o.userData.part=g.userData.part;g.add(o);return o}
  function buildShape(s:Shape){
   const g=groups[s.system];if(!g)return;const m=palette[s.material]||palette.dark;const at=s.at||[0,0,0];
   const positions:[number,number,number][]=[];
   const nx=s.repeat?.count[0]||1,nz=s.repeat?.count[1]||1,ns=s.stack?.count||1;
   for(let i=0;i<nx;i++)for(let j=0;j<nz;j++)for(let k=0;k<ns;k++)positions.push([at[0]+i*(s.repeat?.step[0]||0),at[1]+k*(s.stack?.step||0),at[2]+j*(s.repeat?.step[1]||0)]);
   const mirrored:[number,number,number][]=[];for(const p of positions){mirrored.push(p);if(s.mirror?.includes('x'))mirrored.push([-p[0],p[1],p[2]]);if(s.mirror?.includes('z'))mirrored.push([p[0],p[1],-p[2]]);if(s.mirror==='xz')mirrored.push([-p[0],p[1],-p[2]])}
   for(const p of mirrored){
    if(s.shape==='box')addShape(g,new RoundedBoxGeometry(...(s.size||[.1,.1,.1]),3,s.radius??.04),m,p);
    else if(s.shape==='cylinder'){const o=addShape(g,new THREE.CylinderGeometry(s.radius||.1,s.radius||.1,s.length||.5,36),m,p);if((s.axis||'z')==='z')o.rotation.x=Math.PI/2;else if(s.axis==='x')o.rotation.z=Math.PI/2}
    else if(s.shape==='torus'){const o=addShape(g,new THREE.TorusGeometry(s.radius||.1,s.tube||.02,8,24),m,p);o.rotation.x=Math.PI/2}
    else if(s.shape==='tube'&&s.points){const fx=at[0]===0||Math.sign(p[0])===Math.sign(at[0])?1:-1,fz=at[2]===0||Math.sign(p[2])===Math.sign(at[2])?1:-1;
     const pts=s.points.map(q=>new THREE.Vector3(q[0]*fx,q[1],q[2]*fz));
     addShape(g,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,s.radius||.02,8,false),m,[0,0,0])}
   }
  }
  vehicle.internals?.shapes.forEach(buildShape);
  // ---- Mô hình nguồn ----
  const readyRef={current:false};
  let cancelled=false;
  const pieces:{node:THREE.Object3D;home:THREE.Vector3;spread:THREE.Vector3;part:string;id:string;bounds:THREE.Box3;center:THREE.Vector3;fullSpread:THREE.Vector3;materials:THREE.MeshStandardMaterial[]}[]=[];
  let layout:ReturnType<typeof createExplosionLayout>|null=null;
  const pieceLabels:{b:HTMLButtonElement;id:string;part:string;center:THREE.Vector3;spread:THREE.Vector3;fullSpread:THREE.Vector3}[]=[];
  const disposeObject=(root:THREE.Object3D)=>root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())}});
  const byId=new Map(vehicle.manifest.objects.map(p=>[p.id,p]));
  const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);loader.load(modelUrl,gltf=>{
   if(cancelled){disposeObject(gltf.scene);return}
   Object.values(groups).forEach(g=>g.position.set(0,0,0));scene.updateMatrixWorld(true);
   const model=gltf.scene;scene.add(model);model.updateMatrixWorld(true);
   const nodes:THREE.Object3D[]=[];model.traverse(o=>{if(o.userData.component)nodes.push(o)});
   nodes.forEach(node=>{
    const component=node.userData.component as string;const id=systemFor(node.userData.part as string,vehicle);groups[id].attach(node);
    const bounds=new THREE.Box3().setFromObject(node);const center=bounds.getCenter(new THREE.Vector3());
    const side=Math.sign(center.z)||1;const part=node.userData.part as string;
    const spread=new THREE.Vector3(id==='body'?center.x*.17:0,0,part==='wheels'||part==='brakes'?side*.95*S:id==='doors'?side*.9*S:id==='glass'?side*.12:id==='cabin'?side*.25*S:0);
    pieces.push({node,home:node.position.clone(),spread,part:id,id:component,bounds,center,fullSpread:new THREE.Vector3(),materials:[]});
    node.traverse(o=>{if(o instanceof THREE.Mesh){o.userData.part=id;o.userData.component=component;o.castShadow=true;o.receiveShadow=true;
     const materials=Array.isArray(o.material)?o.material:[o.material];o.material=Array.isArray(o.material)?materials.map(m=>m.clone()):materials[0].clone();
     (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m instanceof THREE.MeshStandardMaterial){if(m instanceof THREE.MeshPhysicalMaterial&&m.transmission>0){m.transmission=0;m.metalness=.25;m.roughness=.18;m.transparent=true;m.opacity=Math.min(m.opacity,.55)}
      pieces[pieces.length-1].materials.push(m);m.envMapIntensity=1.3;m.userData.baseEmission=m.emissive.clone();m.userData.baseIntensity=m.emissiveIntensity;}});
    }});
   });
   if(!pieces.length){setError(T.noPieces);return}
   layout=createExplosionLayout(pieces);
   pieces.forEach((piece,i)=>{
    piece.fullSpread.copy(layout!.pieces.get(piece.id)!.translation);
    const meta=byId.get(piece.id);const label=meta?pieceLabel(meta,latest.current.lang,vehicle):T.unknownPiece;
    const b=document.createElement('button');b.className='mesh-marker';b.textContent=String(i+1);b.title=label;b.setAttribute('aria-label',T.inspectPiece(i+1,label));
    b.addEventListener('click',()=>{latest.current.onSelect(piece.part);latest.current.onInspect(piece.id)});el.appendChild(b);
    pieceLabels.push({b,id:piece.id,part:piece.part,center:piece.center,spread:piece.spread,fullSpread:piece.fullSpread});labelRefs.current.pieces.push({b,id:piece.id,index:i});
   });
   const positions=new Float32Array(pieces.length*3);markerGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
   scene.remove(model);readyRef.current=true;setReady(true);fitView(true);invalidated=true;renderer.shadowMap.needsUpdate=true;
  },xhr=>{if(xhr.total)setProgress(Math.round(xhr.loaded/xhr.total*100))},()=>{if(!cancelled)setError(T.loadFail)});
  const markerGeometry=new THREE.BufferGeometry();
  const markerMaterial=new THREE.PointsMaterial({color:0xc9682e,size:4,sizeAttenuation:false,depthWrite:false,depthTest:false,transparent:true,opacity:.75});
  const markers=new THREE.Points(markerGeometry,markerMaterial);markers.visible=false;markers.frustumCulled=false;markers.renderOrder=10;scene.add(markers);
  // ---- Bệ trưng bày và sàn ----
  const stage=new THREE.Group();scene.add(stage);const R=Math.max(1.6,L*.7);
  const stageMaterial=new THREE.MeshStandardMaterial({color:0xd6d0c6,metalness:.2,roughness:.55,transparent:true});
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(R,R+.05,.13,96),stageMaterial);plinth.position.y=-.12;plinth.receiveShadow=true;stage.add(plinth);
  const rimMaterial=new THREE.MeshStandardMaterial({color:0x8f9aa5,metalness:.7,roughness:.35,transparent:true});
  for(const radius of [R-.19,R-.04]){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.007,5,128),rimMaterial);ring.rotation.x=-Math.PI/2;ring.position.y=-.05;stage.add(ring)}
  const groundMaterial=new THREE.MeshStandardMaterial({color:0xe6e1d8,roughness:.9,metalness:.05,transparent:true});const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.y=-.19;ground.receiveShadow=true;scene.add(ground);
  const grid=new THREE.GridHelper(100,100,0xb9b2a6,0xcdc7bc);grid.position.y=-.185;const gridMaterial=grid.material as THREE.Material;gridMaterial.transparent=true;gridMaterial.opacity=.35;scene.add(grid);
  const labelNodes=systems.map((p,i)=>{const b=document.createElement('button');b.className='scene-label';b.setAttribute('aria-label',T.inspect(p.name));b.innerHTML='<span>'+String(i+1).padStart(2,'0')+'</span><strong>'+p.name.replace(/</g,'&lt;')+'</strong>';b.addEventListener('click',()=>latest.current.onSelect(p.id));el.appendChild(b);return {b,id:p.id}});labelRefs.current.systems=labelNodes;
  let viewWidth=1,viewHeight=1;
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;viewWidth=w;viewHeight=h;renderer.setPixelRatio(pixelRatio);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(readyRef.current){invalidated=true;framingTime=.8}};const observer=new ResizeObserver(resize);observer.observe(el);resize();
  const taps=new PointerTap();const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();
  const onDown=(e:PointerEvent)=>{taps.down(e.pointerId,e.clientX,e.clientY,e.pointerType==='touch'?10:5)};
  const onMove=(e:PointerEvent)=>{taps.move(e.pointerId,e.clientX,e.clientY)};
  const onCancel=(e:PointerEvent)=>{taps.cancel(e.pointerId)};
  const onUp=(e:PointerEvent)=>{if(!taps.up(e.pointerId,e.clientX,e.clientY))return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);if(markers.visible){let nearest=-1,nearestDistance=e.pointerType==='touch'?324:64;pieces.forEach((piece,i)=>{if(!groups[piece.part].visible)return;vector.copy(piece.center).add(piece.node.position).sub(piece.home).add(groups[piece.part].position).project(camera);const dx=(vector.x-pointer.x)*viewWidth/2,dy=(vector.y-pointer.y)*viewHeight/2,d=dx*dx+dy*dy;if(vector.z<1&&d<nearestDistance){nearest=i;nearestDistance=d}});if(nearest>=0){latest.current.onSelect(pieces[nearest].part);latest.current.onInspect(pieces[nearest].id);return}}
   const hits=raycaster.intersectObjects(Object.values(groups),true).filter(h=>{let o:THREE.Object3D|null=h.object;while(o){if(!o.visible)return false;o=o.parent}return true});if(hits[0]){latest.current.onSelect(hits[0].object.userData.part);latest.current.onInspect(hits[0].object.userData.component||'')}};
  renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointermove',onMove);renderer.domElement.addEventListener('pointercancel',onCancel);renderer.domElement.addEventListener('pointerup',onUp);
  const lost=(e:Event)=>{e.preventDefault();setError(T.contextLost)};renderer.domElement.addEventListener('webglcontextlost',lost);
  let raf=0;let amount=latest.current.explode/100;const vector=new THREE.Vector3();let last=performance.now();
  let focusKey='';let previousExplosion=latest.current.explode;let framingTime=0;
  let invalidated=true,previousProps:Props|null=null,lastLabels=0,lastShadow=0;
  let labelsPending=false;let lastHighlighted='';let hiddenKey='';let hidden=new Set<string>();const cameraPosition=new THREE.Vector3(),cameraQuaternion=new THREE.Quaternion();
  const homeTarget=new THREE.Vector3(0,dims.height*.47,0),framingDirection=overviewDirection.clone();
  function fitView(immediate=false,dt=1/60){
   if(latest.current.isolated)return;
   const f=THREE.MathUtils.smoothstep(immediate?latest.current.explode/100:amount,.4,1);
   const target=homeTarget.clone().lerp(layoutCenter,f);
   const tangent=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
   const fullDistance=layout?Math.max(layout.height/(2*tangent),layout.width/(2*tangent*camera.aspect))*1.18+3:9;
   const assembledDistance=Math.max(10.5,6.6/camera.aspect)*S;
   const distance=THREE.MathUtils.lerp(assembledDistance,fullDistance,f);
   const direction=immediate?overviewDirection:framingDirection.clone().lerp(overviewDirection,f).normalize();
   const blend=immediate?1:1-Math.exp(-8*dt);
   controls.target.lerp(target,blend);camera.position.lerp(target.addScaledVector(direction,distance),blend);
  }
  const stopFraming=()=>{framingTime=0};controls.addEventListener('start',stopFraming);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(now:number){raf=requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;
   const p=latest.current,propsChanged=!previousProps||p.selected!==previousProps.selected||p.focusedMesh!==previousProps.focusedMesh||p.isolated!==previousProps.isolated||p.labels!==previousProps.labels||p.autoRotate!==previousProps.autoRotate||p.hiddenIds!==previousProps.hiddenIds;
   if(p.hiddenIds!==hiddenKey){hiddenKey=p.hiddenIds;hidden=new Set(p.hiddenIds?p.hiddenIds.split(','):[])}
   const shown=(id:string)=>p.isolated?p.selected===id:!hidden.has(id);
   if(p.explode!==previousExplosion){previousExplosion=p.explode;framingTime=1.5;framingDirection.copy(camera.position).sub(controls.target).normalize()}
   const oldAmount=amount;amount=reduced?p.explode/100:THREE.MathUtils.damp(amount,p.explode/100,7,dt);if(Math.abs(amount-p.explode/100)<.0001)amount=p.explode/100;
   const moving=oldAmount!==amount,geometryChanged=moving||invalidated||propsChanged;
   adaptQuality(dt,moving||framingTime>0||p.autoRotate);applyPixelRatio(p.explode);
   const individual=THREE.MathUtils.smoothstep(amount,.4,1);
   if(scene.fog instanceof THREE.Fog){scene.fog.near=16*S+individual*384;scene.fog.far=55*S+individual*445;}
   framingTime=Math.max(0,framingTime-dt);if(framingTime>0)fitView(false,dt);
   controls.autoRotate=p.autoRotate&&!reduced;controls.update();
   const cameraChanged=camera.position.distanceToSquared(cameraPosition)>1e-10||1-Math.abs(camera.quaternion.dot(cameraQuaternion))>1e-10;
   if(!geometryChanged&&!cameraChanged&&!(labelsPending&&now-lastLabels>50))return;
   labelsPending=true;
   if(geometryChanged){
    ground.position.y=-.19-.85*amount-individual*(layout?.height||0)*.6;grid.position.y=ground.position.y+.005;
    stage.visible=amount<.18&&!p.isolated;stageMaterial.opacity=1-THREE.MathUtils.smoothstep(amount,.02,.18);rimMaterial.opacity=stageMaterial.opacity;
    const floor=p.isolated?0:1-THREE.MathUtils.smoothstep(individual,.02,.32);groundMaterial.opacity=floor;gridMaterial.opacity=.35*floor;
    ground.visible=floor>.005;grid.visible=floor>.005;renderer.shadowMap.enabled=floor>.05;
    systems.forEach(({id})=>{const g=groups[id],o=offsets[id];g.position.set(o[0]*amount*(1-individual),o[1]*amount*(1-individual),o[2]*amount*(1-individual));g.visible=shown(id);
     if(illustrative.has(id))g.visible=g.visible&&(amount>.08||p.isolated)&&(individual<.98||p.isolated);
    });
    const positions=markerGeometry.getAttribute('position') as THREE.BufferAttribute|undefined;
    pieces.forEach((piece,i)=>{
     piece.node.position.copy(piece.home).addScaledVector(piece.spread,amount*(1-individual)).addScaledVector(piece.fullSpread,individual);
     piece.node.visible=!p.isolated||!p.focusedMesh||p.focusedMesh===piece.id;
     if(positions){if(shown(piece.part)){vector.copy(piece.center).add(piece.node.position).sub(piece.home).add(groups[piece.part].position);positions.setXYZ(i,vector.x,vector.y,vector.z)}else positions.setXYZ(i,0,-1e5,0)}
    });
    if(positions)positions.needsUpdate=true;
    markers.visible=individual>.45&&!p.isolated&&!p.labels;
    markerMaterial.opacity=THREE.MathUtils.smoothstep(individual,.45,.9)*.75;
    if(p.focusedMesh!==lastHighlighted||invalidated){
     for(const piece of pieces)if(piece.id===lastHighlighted||piece.id===p.focusedMesh){
      for(const m of piece.materials){m.emissive.copy(m.userData.baseEmission);m.emissiveIntensity=m.userData.baseIntensity;if(piece.id===p.focusedMesh){m.emissive.set('#2f6fd6');m.emissiveIntensity=.28}}
     }
     lastHighlighted=p.focusedMesh;
    }
    if(renderer.shadowMap.enabled&&(!moving||now-lastShadow>80)){renderer.shadowMap.needsUpdate=true;lastShadow=now}
   }
   const nextFocus=p.isolated?(p.focusedMesh||p.selected):'';
   if(readyRef.current&&nextFocus!==focusKey){
    focusKey=nextFocus;
    if(nextFocus){
     const target=p.focusedMesh?pieces.find(x=>x.id===p.focusedMesh)?.node:groups[p.selected];
     if(target){scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(target);const center=bounds.getCenter(new THREE.Vector3());const extent=bounds.getSize(new THREE.Vector3()).length();const direction=camera.position.clone().sub(controls.target).normalize();controls.minDistance=.15;controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,Math.max(.4,extent*1.8));}
    }else{controls.minDistance=.15;fitView(true)}
    controls.update();
   }
   if(p.isolated&&readyRef.current&&geometryChanged){
    const target=p.focusedMesh?pieces.find(x=>x.id===p.focusedMesh)?.node:groups[p.selected];
    if(target){scene.updateMatrixWorld(true);const center=new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3());const movement=center.clone().sub(controls.target);camera.position.add(movement);controls.target.copy(center);controls.update()}
   }
   if(now-lastLabels>50||propsChanged||invalidated){
    lastLabels=now;labelsPending=false;
    labelNodes.forEach(({b,id})=>{const show=individual<.5&&readyRef.current&&p.labels&&(!illustrative.has(id)||amount>.08||p.isolated)&&shown(id);
     if(b.hidden===show)b.hidden=!show;if(!show)return;
     const a=anchors[id];vector.set(...a).add(groups[id].position).project(camera);b.style.display=vector.z<1?'flex':'none';b.classList.toggle('chosen',id===p.selected);
     b.style.transform=`translate3d(${(vector.x*.5+.5)*viewWidth}px,${(-vector.y*.5+.5)*viewHeight}px,0) translate(-12px,-50%)`;
    });
    pieceLabels.forEach(({b,id,part,center,spread,fullSpread})=>{
     const show=individual>.45&&(p.labels||id===p.focusedMesh)&&shown(part)&&(!p.isolated||!p.focusedMesh||p.focusedMesh===id);
     if(b.hidden===show)b.hidden=!show;if(!show)return;
     vector.copy(center).addScaledVector(spread,amount*(1-individual)).addScaledVector(fullSpread,individual).add(groups[part].position).project(camera);
     b.style.display=vector.z<1&&Math.abs(vector.x)<1&&Math.abs(vector.y)<1?'grid':'none';b.classList.toggle('chosen',p.focusedMesh===id);b.classList.add('numbered');
     b.style.transform=`translate3d(${(vector.x*.5+.5)*viewWidth}px,${(-vector.y*.5+.5)*viewHeight}px,0) translate(-50%,-50%)`;
    });
   }
   cameraPosition.copy(camera.position);cameraQuaternion.copy(camera.quaternion);previousProps=p;invalidated=false;
   renderer.render(scene,camera);
  }raf=requestAnimationFrame(frame);
  return()=>{cancelled=true;labelRefs.current={systems:[],pieces:[]};cancelAnimationFrame(raf);observer.disconnect();controls.removeEventListener('start',stopFraming);controls.dispose();markerGeometry.dispose();markerMaterial.dispose();engine.current=null;labelNodes.forEach(x=>x.b.remove());pieceLabels.forEach(x=>x.b.remove());renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointermove',onMove);renderer.domElement.removeEventListener('pointercancel',onCancel);renderer.domElement.removeEventListener('pointerup',onUp);renderer.domElement.removeEventListener('webglcontextlost',lost);scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose())}});env.dispose();pmrem.dispose();room.dispose();renderer.dispose();renderer.domElement.remove();};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[modelUrl]); // eslint-disable-line react-hooks/exhaustive-deps
 const name=`${vehicle.meta.brand} ${vehicle.meta.name}`;
 return <><div ref={host} className="canvas-host" aria-label={t.sceneLabel(name)}/>{!ready&&!error&&<div className="scene-loading" aria-live="polite"><span/>{progress>0&&progress<100?t.loadingProgress(progress):t.loadingModel(name)}<i className="scene-progress" style={{width:`${progress}%`}}/></div>}{error&&<div className="scene-error"><h3>{t.needsMoment}</h3><p>{error}</p><button onClick={()=>location.reload()}>{t.reload}</button></div>}</>;
});
export default VehicleScene;
