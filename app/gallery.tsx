import {ArrowUpRight} from 'lucide-react';
import {UI,type Lang} from './i18n/ui';
import type {Registry} from './registry';
import {vehicleHref} from './router';
import LangToggle from './lang-toggle';

export default function Gallery({lang,setLang,registry,error}:{lang:Lang;setLang:(l:Lang)=>void;registry:Registry|null;error:boolean}){
 const t=UI[lang];
 const groups=new Map<string,Registry['vehicles']>();
 for(const v of registry?.vehicles??[]){const list=groups.get(v.type)||[];list.push(v);groups.set(v.type,list)}
 return <main className="gallery">
  <header className="gallery-header">
   <div><span className="wordmark">{t.appName}</span><h1>{t.appTagline}</h1><p>{t.galleryIntro}</p></div>
   <LangToggle lang={lang} setLang={setLang}/>
  </header>
  {error&&<p className="gallery-empty">{t.noModelHelp}</p>}
  {[...groups.entries()].map(([type,list])=><section key={type} className="gallery-group" aria-label={t.types[type]||type}>
   <h2>{t.types[type]||type}</h2>
   <div className="gallery-grid">
    {list.map(v=><a key={v.id} className={'vehicle-card '+(v.ready?'':'is-pending')} href={v.ready?vehicleHref(v.id,lang):undefined} aria-disabled={!v.ready}>
     <div className="vehicle-thumb">{v.thumbnail?<img src={v.thumbnail} alt="" loading="lazy"/>:<span className="vehicle-thumb-fallback">{v.name}</span>}</div>
     <div className="vehicle-card-body">
      <span className="vehicle-brand">{v.brand}{v.year?<em> · {v.year}</em>:null}</span>
      <strong>{v.name}</strong>
      <p>{v.tagline?.[lang]}</p>
      <span className="vehicle-meta">{v.ready?`${v.pieces} ${t.pieces}`:'…'}{v.creator?` · ${v.creator}`:''}{v.ready&&<ArrowUpRight size={13}/>}</span>
     </div>
    </a>)}
   </div>
  </section>)}
  <footer className="gallery-footer"><p>{t.aboutIllustrative}</p></footer>
 </main>;
}
