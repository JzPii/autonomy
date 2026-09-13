import {flushSync} from 'react-dom';
import {useState, useRef, useEffect, useMemo} from 'react';
import {ArrowUpRight, Box, Layers3, RotateCcw, Rotate3d, Plus, Minus, Maximize2, X, Crosshair, ChevronRight, CircleHelp, Expand, MoreHorizontal, Search} from 'lucide-react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Slider} from '@/components/ui/slider';
import {Switch} from '@/components/ui/switch';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {UI,type Lang} from './i18n/ui';
import {pieceLabel,pieceNote} from './labels';
import {loadVehicle,systemFor,type Registry,type Vehicle} from './registry';
import {galleryHref} from './router';
import {registerStudioTools} from './agent-tools';
import LangToggle from './lang-toggle';
import Switcher from './switcher';
import SearchPanel, {type SearchHit} from './search';
import VehicleScene, {type SceneHandle} from './vehicle-scene';
const compactQuery='(max-width: 700px), (max-height: 500px)';
function readUrlState(){
 const q=new URLSearchParams(location.search);const explode=Number(q.get('explode'));
 return {system:q.get('system')||'',piece:q.get('piece')||'',explode:Number.isFinite(explode)?Math.min(100,Math.max(0,Math.round(explode))):0,labels:q.get('labels')==='1'};
}
export default function Studio({id,lang,setLang,registry}:{id:string;lang:Lang;setLang:(l:Lang)=>void;registry:Registry|null}){
 const t=UI[lang];
 const [vehicle,setVehicle]=useState<Vehicle|null>(null);const [loadError,setLoadError]=useState(false);
 useEffect(()=>{let live=true;loadVehicle(id,lang).then(v=>{if(live)setVehicle(v)}).catch(()=>{if(live)setLoadError(true)});return()=>{live=false}},[id,lang]);
 const initial=useMemo(readUrlState,[]);
 const [selected,setSelected]=useState<string>(initial.system);
 const [canFullscreen,setCanFullscreen]=useState(false);
 const [compact,setCompact]=useState(false);const [toolsOpen,setToolsOpen]=useState(false);
 const [componentsOpen,setComponentsOpen]=useState(false);const [detailOpen,setDetailOpen]=useState(Boolean(initial.system||initial.piece));
 const [explode,setExplode]=useState(initial.explode); const [labels,setLabels]=useState(initial.labels); const [rotate,setRotate]=useState(false); const [isolated,setIsolated]=useState(false); const [help,setHelp]=useState(false); const [searchOpen,setSearchOpen]=useState(false);
 const [focusedMesh,setFocusedMesh]=useState(initial.piece);
 useEffect(()=>{setCanFullscreen(Boolean(document.fullscreenEnabled));const query=window.matchMedia(compactQuery);const update=()=>{setCompact(query.matches);setComponentsOpen(!query.matches);setToolsOpen(false)};update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update)},[]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='/'&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement)){e.preventDefault();setSearchOpen(true);if(window.matchMedia(compactQuery).matches){setComponentsOpen(false);setDetailOpen(false);setHelp(false)}}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[]);
 // Default system once content is known; keep URL shareable.
 const systems=useMemo(()=>vehicle?.content.systems??[],[vehicle]);
 useEffect(()=>{if(vehicle&&!systems.some(s=>s.id===selected))setSelected(systems[0]?.id||'')},[vehicle,systems,selected]);
 useEffect(()=>{if(!vehicle)return;const u=new URL(location.href);const set=(k:string,v:string|null)=>{if(v)u.searchParams.set(k,v);else u.searchParams.delete(k)};set('system',detailOpen?selected:null);set('piece',focusedMesh||null);set('explode',explode?String(explode):null);set('labels',labels?'1':null);history.replaceState(null,'',u)},[vehicle,selected,detailOpen,focusedMesh,explode,labels]);
 const [tab,setTab]=useState('overview'); const scene=useRef<SceneHandle|null>(null); const root=useRef<HTMLDivElement>(null);
 function select(sid:string){setFocusedMesh('');setSelected(sid);setTab('overview');setDetailOpen(true);setSearchOpen(false);if(compact){setComponentsOpen(false);setHelp(false);setToolsOpen(false)}}
 function inspect(pieceId:string){setFocusedMesh(pieceId);if(pieceId&&vehicle){const p=vehicle.manifest.objects.find(x=>x.id===pieceId);if(p){setSelected(systemFor(p.part,vehicle));setDetailOpen(true);setTab('overview')}}}
 useEffect(()=>{if(!vehicle)return;return registerStudioTools(vehicle,lang,{
  select(sid){flushSync(()=>select(sid))},inspect(pid){flushSync(()=>{inspect(pid);setSearchOpen(false)})},
  setExplode(v){flushSync(()=>setExplode(v))},setIsolated(v){flushSync(()=>setIsolated(v))},
 })},[vehicle,lang]); // eslint-disable-line react-hooks/exhaustive-deps
 function toggleComponents(){setComponentsOpen(!componentsOpen);if(compact){setDetailOpen(false);setHelp(false);setToolsOpen(false);setSearchOpen(false)}}
 function toggleHelp(){setHelp(!help);if(compact){setComponentsOpen(false);setDetailOpen(false);setToolsOpen(false);setSearchOpen(false)}}
 function toggleSearch(){setSearchOpen(!searchOpen);if(compact){setComponentsOpen(false);setDetailOpen(false);setHelp(false);setToolsOpen(false)}}
 function pick(hit:SearchHit){if(hit.kind==='system'){select(hit.id);setIsolated(false)}else{setSearchOpen(false);inspect(hit.piece.id);setIsolated(true);if(compact){setComponentsOpen(false)}}}

 if(loadError)return <main className="studio"><div className="scene-error"><h3>{t.notFound}</h3><p>{t.noModelHelp}</p><a className="isolate-button" href={galleryHref(lang)}>{t.backToGallery}</a></div></main>;
 if(!vehicle)return <main className="studio"><div className="scene-loading" aria-live="polite"><span/>{t.loadingCatalog}</div></main>;
 const meta=vehicle.meta;const name=`${meta.brand} ${meta.name}`;
 const catalog=vehicle.manifest.objects;
 const system=systems.find(s=>s.id===selected)||systems[0];
 const piece=catalog.find(p=>p.id===focusedMesh);
 const inSystem=catalog.filter(p=>systemFor(p.part,vehicle)===system.id);
 const sourceLink=meta.links?.[system.source]||system.source;

 return <main className="studio" ref={root}>
  <section className="stage-view" aria-label={t.studioLabel(name)}>
   <VehicleScene vehicle={vehicle} lang={lang} focusedMesh={focusedMesh} onInspect={inspect} ref={scene} selected={system.id} explode={explode} labels={labels} autoRotate={rotate} isolated={isolated} onSelect={select}/>
  </section>
  <Switcher meta={meta} registry={registry} lang={lang}/>
  {componentsOpen&&<aside className="components-panel floating-panel" aria-label={t.systems}>
   <div className="panel-heading"><h2>{t.systems}</h2><button className="icon-button" onClick={()=>setComponentsOpen(false)} aria-label={t.hideSystems}><X size={14}/></button></div>
   <div className="parts-list">{systems.map((p,i)=><button key={p.id} onClick={()=>select(p.id)} className={'part-row '+(p.id===system.id&&detailOpen?'selected':'')} aria-pressed={p.id===system.id&&detailOpen}><span className="part-number">{String(i+1).padStart(2,'0')}</span><span>{p.name}</span><ChevronRight size={13}/></button>)}</div>
  </aside>}
  <nav className="view-tools floating-panel" data-expanded={toolsOpen} aria-label={t.moreControls}>
   <button className={'tools-components '+(componentsOpen?'active':'')} title={t.systems} onClick={toggleComponents} aria-label={t.toggleSystems} aria-pressed={componentsOpen}><Layers3 size={18}/></button>
   <button className={'tools-components '+(searchOpen?'active':'')} title={t.search+' (/)'} onClick={toggleSearch} aria-label={t.search} aria-pressed={searchOpen}><Search size={18}/></button>
   <span/>
   <button className="tools-extra" title={t.zoomIn} onClick={()=>scene.current?.zoom(.85)} aria-label={t.zoomIn}><Plus size={18}/></button>
   <button className="tools-extra" title={t.zoomOut} onClick={()=>scene.current?.zoom(1.18)} aria-label={t.zoomOut}><Minus size={18}/></button>
   <button className="tools-reset" title={t.resetView} onClick={()=>{setRotate(false);scene.current?.reset()}} aria-label={t.resetView}><RotateCcw size={17}/></button>
   <button className={'tools-extra '+(rotate?'active':'')} title={t.autoRotate} onClick={()=>setRotate(!rotate)} aria-label={t.autoRotate} aria-pressed={rotate}><Rotate3d size={18}/></button>
   <span/>
   {canFullscreen&&<button className="tools-extra" title={t.fullscreen} onClick={()=>{if(document.fullscreenElement)document.exitFullscreen();else root.current?.requestFullscreen?.()}} aria-label={t.fullscreen}><Maximize2 size={17}/></button>}
   <button className="tools-extra" title={t.about} onClick={toggleHelp} aria-label={t.about} aria-expanded={help}><CircleHelp size={17}/></button>
   <LangToggle lang={lang} setLang={setLang} className="tools-lang"/>
   <button className="tools-more" title={t.moreControls} onClick={()=>setToolsOpen(!toolsOpen)} aria-label={t.moreControls} aria-expanded={toolsOpen}><MoreHorizontal size={20}/></button>
  </nav>
  {searchOpen&&<SearchPanel vehicle={vehicle} lang={lang} onPick={pick} onClose={()=>setSearchOpen(false)}/>}
  {detailOpen&&<aside className="detail-panel floating-panel" aria-label={t.details}>
   <div className="panel-heading"><span>{system.category}{system.illustrative&&<span className="illustrative-badge">{t.illustrative}</span>}</span><button className="icon-button" onClick={()=>setDetailOpen(false)} aria-label={t.closeDetails}><X size={16}/></button></div>
   <div className="detail" aria-live="polite">
    <h2>{piece?pieceLabel(piece,lang,vehicle):system.name}</h2>
    <Tabs value={tab} onValueChange={v=>setTab(String(v))}><TabsList variant="line" className="detail-tabs"><TabsTrigger value="overview">{t.overview}</TabsTrigger><TabsTrigger value="working">{t.howItWorks}</TabsTrigger></TabsList></Tabs>
    <p className="detail-copy">{piece&&tab==='overview'?pieceNote(piece,lang,vehicle):tab==='overview'?system.description:system.principle}</p>
    <dl className="specs">{system.specs.map(([a,b])=><div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
    {inSystem.length>0&&<div className="piece-picker"><span>{t.individualPieces}</span><Select value={focusedMesh||'all'} onValueChange={value=>setFocusedMesh(value==='all'?'':String(value))}><SelectTrigger aria-label={t.choosePiece}><SelectValue>{piece?pieceLabel(piece,lang,vehicle):t.allPieces(inSystem.length)}</SelectValue></SelectTrigger><SelectContent alignItemWithTrigger={false}>{[{id:'all',label:t.allInSystem},...inSystem.map(p=>({id:p.id,label:pieceLabel(p,lang,vehicle)}))].map((p,i)=><SelectItem key={p.id} value={p.id}>{i?`${String(i).padStart(2,'0')} · `:''}{p.label}</SelectItem>)}</SelectContent></Select></div>}
    <button className={'isolate-button '+(isolated?'is-active':'')} onClick={()=>setIsolated(!isolated)}>{isolated?<Layers3 size={15}/>:<Crosshair size={15}/>} {isolated?t.showAll:focusedMesh?t.isolatePiece:t.isolateSystem}</button>
    {sourceLink&&<a className="source-link" href={sourceLink} target="_blank" rel="noreferrer">{t.documentation(meta.brand)} <ArrowUpRight size={12}/></a>}
   </div>
  </aside>}
  <div className="explode-dock floating-panel" aria-label={t.assemblyControls}>
   <button className={'assembly-button '+(explode===0?'active':'')} title={t.assemble} onClick={()=>{setExplode(0);setIsolated(false)}} aria-label={t.assembleLabel}><Box size={18}/><span>{t.assemble}</span></button>
   <div className="explode-control"><div className="slider-caption"><span id="explode-label">{t.explode}</span><output>{explode===100?`${catalog.length} ${t.piecesShort}`:`${explode}%`}</output></div><Slider aria-labelledby="explode-label" value={[explode]} onValueChange={v=>setExplode(Array.isArray(v)?v[0]:v)} min={0} max={100}/></div>
   <button className={'assembly-button '+(explode===100?'active':'')} title={t.separateAll} onClick={()=>{setExplode(100);setIsolated(false)}} aria-label={t.separateAll}><Expand size={18}/><span>{t.allParts}</span></button>
   <div className="dock-divider"/><div className="labels-toggle"><Switch checked={labels} onCheckedChange={setLabels} aria-label={t.showLabels}/><span>{t.labels}</span></div>
  </div>
  {help&&<aside className="about-panel floating-panel" aria-label={t.about}><div className="panel-heading"><h2>{t.aboutTitle}</h2><button className="icon-button" onClick={()=>setHelp(false)} aria-label={t.about}><X size={15}/></button></div>
   <p>{t.aboutHelp}</p>
   <p>{t.aboutModel(catalog.length,'')}<a href={meta.attribution.source} target="_blank" rel="noreferrer">{meta.attribution.title}</a> — <a href={meta.attribution.creatorUrl||meta.attribution.source} target="_blank" rel="noreferrer">{meta.attribution.creator}</a> ({t.license} <a href={meta.attribution.licenseUrl} target="_blank" rel="noreferrer">{meta.attribution.license}</a>).</p>
   {systems.some(s=>s.illustrative)&&<p>{t.aboutIllustrative}</p>}
   <p>{t.aboutDisclaimer(meta.brand)} {meta.links?.specs&&<a href={meta.links.specs} target="_blank" rel="noreferrer">{t.specsSource}</a>}</p>
  </aside>}
 </main>
}
