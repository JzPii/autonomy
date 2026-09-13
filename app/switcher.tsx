import {useEffect,useRef,useState} from 'react';
import {ChevronDown,LayoutGrid} from 'lucide-react';
import {UI,type Lang} from './i18n/ui';
import type {ModelMeta,Registry} from './registry';
import {galleryHref,vehicleHref} from './router';

/** Top-left plaque: brand + model, opens the vehicle list. */
export default function Switcher({meta,registry,lang}:{meta:ModelMeta;registry:Registry|null;lang:Lang}){
 const t=UI[lang];const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const close=(e:MouseEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)};document.addEventListener('pointerdown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',key)}},[open]);
 const groups=new Map<string,Registry['vehicles']>();for(const v of registry?.vehicles??[]){const l=groups.get(v.type)||[];l.push(v);groups.set(v.type,l)}
 return <div className="model-plaque switcher" ref={root}>
  <button className="switcher-button" onClick={()=>setOpen(!open)} aria-expanded={open} aria-haspopup="listbox" aria-label={t.switchVehicle}>
   <span>{meta.brand.toUpperCase().split('').join(' ')}</span><h1>{meta.name} <ChevronDown size={16}/></h1>
  </button>
  {open&&<div className="switcher-menu floating-panel" role="listbox" aria-label={t.vehicleList}>
   {[...groups.entries()].map(([type,list])=><div key={type} className="switcher-group"><span className="switcher-type">{t.types[type]||type}</span>
    {list.map(v=><a key={v.id} role="option" aria-selected={v.id===meta.id} className={'switcher-item '+(v.id===meta.id?'current':'')+(v.ready?'':' pending')} href={v.ready?vehicleHref(v.id,lang):undefined}><strong>{v.brand} {v.name}</strong><small>{v.tagline?.[lang]}{v.ready?'':' · …'}</small></a>)}
   </div>)}
   <a className="switcher-item switcher-all" href={galleryHref(lang)}><LayoutGrid size={14}/> {t.gallery}</a>
  </div>}
 </div>;
}
