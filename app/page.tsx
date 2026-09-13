import {flushSync} from 'react-dom';
import {useState, useRef, useEffect} from 'react';
import {ArrowUpRight, Box, Layers3, RotateCcw, Rotate3d, Plus, Minus, Maximize2, X, Crosshair, ChevronRight, CircleHelp, Expand, MoreHorizontal} from 'lucide-react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Slider} from '@/components/ui/slider';
import {Switch} from '@/components/ui/switch';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {parts,describePiece,illustrative,vehicle,specsPage,type PartId} from './parts';
import {manifestUrl,type Manifest} from './manifest';
import {registerStudioTools} from './agent-tools';
import VehicleScene, {type SceneHandle} from './vehicle-scene';
const compactQuery='(max-width: 700px), (max-height: 500px)';
export default function Home(){
 const [selected,setSelected]=useState<PartId>('body');
 const [canFullscreen,setCanFullscreen]=useState(false);
 const [compact,setCompact]=useState(false);const [toolsOpen,setToolsOpen]=useState(false);
 const [componentsOpen,setComponentsOpen]=useState(false);const [detailOpen,setDetailOpen]=useState(false);
 const [explode,setExplode]=useState(0); const [labels,setLabels]=useState(false); const [rotate,setRotate]=useState(false); const [isolated,setIsolated]=useState(false); const [help,setHelp]=useState(false);
 useEffect(()=>{setCanFullscreen(Boolean(document.fullscreenEnabled));const query=window.matchMedia(compactQuery);const update=()=>{setCompact(query.matches);setComponentsOpen(!query.matches);setToolsOpen(false)};update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update)},[]);
 const [focusedMesh,setFocusedMesh]=useState('');
 const [manifest,setManifest]=useState<Manifest|null>(null);const [manifestError,setManifestError]=useState(false);
 useEffect(()=>{fetch(manifestUrl).then(r=>{if(!r.ok)throw new Error(String(r.status));return r.json()}).then(m=>setManifest(m as Manifest)).catch(()=>setManifestError(true));},[]);
 const catalog=manifest?.objects??[];
 const [tab,setTab]=useState('overview'); const scene=useRef<SceneHandle|null>(null); const root=useRef<HTMLDivElement>(null);
 useEffect(()=>registerStudioTools({
  select(id){flushSync(()=>{setSelected(id);setFocusedMesh('');setDetailOpen(true);setTab('overview');if(window.matchMedia(compactQuery).matches){setComponentsOpen(false);setHelp(false)}})},
  setExplode(v){flushSync(()=>setExplode(v))},
  setIsolated(v){flushSync(()=>setIsolated(v))},
 }),[]);
 const part=parts.find(p=>p.id===selected)!; const piece=catalog.find(p=>p.id===focusedMesh);
 function select(id:PartId){setFocusedMesh('');setSelected(id);setTab('overview');setDetailOpen(true);if(compact){setComponentsOpen(false);setHelp(false);setToolsOpen(false)}}
 function toggleComponents(){setComponentsOpen(!componentsOpen);if(compact){setDetailOpen(false);setHelp(false);setToolsOpen(false)}}
 function toggleHelp(){setHelp(!help);if(compact){setComponentsOpen(false);setDetailOpen(false);setToolsOpen(false)}}
 const inSystem=catalog.filter(p=>p.part===selected);

 return <main className="studio" ref={root}>
  <section className="stage-view" aria-label="Studio VF 9 tương tác">
   {manifest&&<VehicleScene modelUrl={`/models/${manifest.file}?v=${encodeURIComponent(manifest.version)}`} focusedMesh={focusedMesh} onInspect={setFocusedMesh} ref={scene} selected={selected} explode={explode} labels={labels} autoRotate={rotate} isolated={isolated} onSelect={select}/>}
   {!manifest&&!manifestError&&<div className="scene-loading"><span/>Đang đọc danh mục chi tiết…</div>}
   {manifestError&&<div className="scene-error"><h3>Chưa có mô hình.</h3><p>Không tìm thấy tệp danh mục. Hãy chạy <code>npm run model:prepare</code> rồi tải lại trang.</p><button onClick={()=>location.reload()}>Tải lại</button></div>}
  </section>
  <div className="model-plaque"><span>{vehicle.brand.split('').join(' ')}</span><h1>{vehicle.model}</h1>{manifest?.placeholder&&<em className="placeholder-note">Mô hình mẫu · chưa phải VF 9 thật</em>}</div>
  {componentsOpen&&<aside className="components-panel floating-panel" aria-label="Các hệ thống">
   <div className="panel-heading"><h2>Hệ thống</h2><button className="icon-button" onClick={()=>setComponentsOpen(false)} aria-label="Ẩn danh sách hệ thống"><X size={14}/></button></div>
   <div className="parts-list">{parts.map((p,i)=><button key={p.id} onClick={()=>select(p.id)} className={'part-row '+(p.id===selected&&detailOpen?'selected':'')} aria-pressed={p.id===selected&&detailOpen}><span className="part-number">{String(i+1).padStart(2,'0')}</span><span>{p.name}</span><ChevronRight size={13}/></button>)}</div>
  </aside>}
  <nav className="view-tools floating-panel" data-expanded={toolsOpen} aria-label="Điều khiển góc nhìn">
   <button className={'tools-components '+(componentsOpen?'active':'')} title="Hệ thống" onClick={toggleComponents} aria-label="Bật/tắt danh sách hệ thống" aria-pressed={componentsOpen}><Layers3 size={18}/></button>
   <span/>
   <button className="tools-extra" title="Phóng to" onClick={()=>scene.current?.zoom(.85)} aria-label="Phóng to"><Plus size={18}/></button>
   <button className="tools-extra" title="Thu nhỏ" onClick={()=>scene.current?.zoom(1.18)} aria-label="Thu nhỏ"><Minus size={18}/></button>
   <button className="tools-reset" title="Đặt lại góc nhìn" onClick={()=>{setRotate(false);scene.current?.reset()}} aria-label="Đặt lại góc nhìn"><RotateCcw size={17}/></button>
   <button className={'tools-extra '+(rotate?'active':'')} title="Tự xoay" onClick={()=>setRotate(!rotate)} aria-label="Bật/tắt tự xoay" aria-pressed={rotate}><Rotate3d size={18}/></button>
   <span/>
   {canFullscreen&&<button className="tools-extra" title="Toàn màn hình" onClick={()=>{if(document.fullscreenElement)document.exitFullscreen();else root.current?.requestFullscreen?.()}} aria-label="Bật/tắt toàn màn hình"><Maximize2 size={17}/></button>}
   <button className="tools-extra" title="Về mô hình này" onClick={toggleHelp} aria-label="Về mô hình này" aria-expanded={help}><CircleHelp size={17}/></button>
   <button className="tools-more" title="Thêm điều khiển" onClick={()=>setToolsOpen(!toolsOpen)} aria-label="Thêm điều khiển góc nhìn" aria-expanded={toolsOpen}><MoreHorizontal size={20}/></button>
  </nav>
  {detailOpen&&<aside className="detail-panel floating-panel" aria-label="Chi tiết hệ thống">
   <div className="panel-heading"><span>{part.category}{illustrative.includes(selected)&&<span className="illustrative-badge">Minh họa</span>}</span><button className="icon-button" onClick={()=>setDetailOpen(false)} aria-label="Đóng chi tiết"><X size={16}/></button></div>
   <div className="detail" aria-live="polite">
    <h2>{piece?piece.label:part.name}</h2>
    <Tabs value={tab} onValueChange={v=>setTab(String(v))}><TabsList variant="line" className="detail-tabs"><TabsTrigger value="overview">Tổng quan</TabsTrigger><TabsTrigger value="working">Cách hoạt động</TabsTrigger></TabsList></Tabs>
    <p className="detail-copy">{piece&&tab==='overview'?describePiece(piece.label):tab==='overview'?part.description:part.principle}</p>
    <dl className="specs">{part.specs.map(([a,b])=><div key={a}><dt>{a}</dt><dd>{b}</dd></div>)}</dl>
    {inSystem.length>0&&<div className="piece-picker"><span>Từng chi tiết</span><Select value={focusedMesh||'all'} onValueChange={value=>setFocusedMesh(value==='all'?'':String(value))}><SelectTrigger aria-label="Chọn một chi tiết lưới"><SelectValue>{piece?piece.label:`Tất cả ${inSystem.length} chi tiết`}</SelectValue></SelectTrigger><SelectContent alignItemWithTrigger={false}>{[{id:'all',label:'Tất cả chi tiết trong hệ thống này'},...inSystem].map((p,i)=><SelectItem key={p.id} value={p.id}>{i?`${String(i).padStart(2,'0')} · `:''}{p.label}</SelectItem>)}</SelectContent></Select></div>}
    <button className={'isolate-button '+(isolated?'is-active':'')} onClick={()=>setIsolated(!isolated)}>{isolated?<Layers3 size={15}/>:<Crosshair size={15}/>} {isolated?'Hiện toàn bộ':focusedMesh?'Cô lập chi tiết':'Cô lập hệ thống'}</button>
    <a className="source-link" href={part.source} target="_blank" rel="noreferrer">Tài liệu VinFast <ArrowUpRight size={12}/></a>
   </div>
  </aside>}
  <div className="explode-dock floating-panel" aria-label="Điều khiển lắp ráp">
   <button className={'assembly-button '+(explode===0?'active':'')} title="Lắp ráp" onClick={()=>{setExplode(0);setIsolated(false)}} aria-label="Lắp ráp xe"><Box size={18}/><span>Lắp ráp</span></button>
   <div className="explode-control"><div className="slider-caption"><span id="explode-label">Tách rời</span><output>{explode===100?`${catalog.length} chi tiết`:`${explode}%`}</output></div><Slider aria-labelledby="explode-label" value={[explode]} onValueChange={v=>setExplode(Array.isArray(v)?v[0]:v)} min={0} max={100}/></div>
   <button className={'assembly-button '+(explode===100?'active':'')} title="Tách toàn bộ chi tiết" onClick={()=>{setExplode(100);setIsolated(false)}} aria-label="Tách toàn bộ chi tiết"><Expand size={18}/><span>Toàn bộ</span></button>
   <div className="dock-divider"/><div className="labels-toggle"><Switch id="labels-switch" checked={labels} onCheckedChange={setLabels} aria-label="Hiện nhãn"/><span>Nhãn</span></div>
  </div>
  {help&&<aside className="about-panel floating-panel" aria-label="Về mô hình này"><div className="panel-heading"><h2>Về mô hình</h2><button className="icon-button" onClick={()=>setHelp(false)} aria-label="Đóng thông tin mô hình"><X size={15}/></button></div>
   <p>Kéo để xoay. Chụm hoặc cuộn để thu phóng. Chọn một hệ thống để xem chi tiết; kéo thanh trượt để tách rời chiếc xe.</p>
   {manifest?.placeholder
    ?<p><strong>Đây là mô hình mẫu</strong> dựng bằng mã để kiểm thử quy trình. Hãy tải mô hình VF 9 thật vào thư mục <code>source/</code> và chạy <code>npm run model:prepare</code>.</p>
    :<p>Mô hình 3D VF 9 của <a href={manifest?.source||specsPage} target="_blank" rel="noreferrer">{manifest?.creator||'tác giả'}</a>{manifest?.license&&<> (giấy phép <a href={manifest.licenseUrl} target="_blank" rel="noreferrer">{manifest.license}</a>)</>}. {catalog.length} chi tiết là các đảo lưới do người dựng mô hình tạo ra, không phải danh mục phụ tùng VinFast. Pin, động cơ và hệ thống treo là hình minh họa.</p>}
   <p>Dự án giáo dục độc lập, không liên kết với VinFast. Thông số tham khảo từ <a href={specsPage} target="_blank" rel="noreferrer">trang thông số chính thức</a>.</p>
  </aside>}
 </main>
}
