import {useEffect,useMemo,useRef,useState} from 'react';
import {Search as SearchIcon,X} from 'lucide-react';
import {UI,type Lang} from './i18n/ui';
import {pieceLabel} from './labels';
import {systemFor,type Piece,type Vehicle} from './registry';

export type SearchHit={kind:'system';id:string;name:string}|{kind:'piece';piece:Piece;label:string;systemId:string;systemName:string};
const normalise=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d');

/** "Find a structure": pieces and systems by name in either language, grouped by system. */
export default function SearchPanel({vehicle,lang,onPick,onClose}:{vehicle:Vehicle;lang:Lang;onPick:(hit:SearchHit)=>void;onClose:()=>void}){
 const t=UI[lang];const [query,setQuery]=useState('');const [active,setActive]=useState(0);const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{input.current?.focus()},[]);
 const other:Lang=lang==='vi'?'en':'vi';
 const index=useMemo(()=>vehicle.manifest.objects.map(p=>{const label=pieceLabel(p,lang,vehicle);const systemId=systemFor(p.part,vehicle);return {p,label,systemId,haystack:normalise(label+' '+pieceLabel(p,other,vehicle))}}),[vehicle,lang,other]);
 const hits=useMemo<SearchHit[]>(()=>{
  const q=normalise(query.trim());if(!q)return [];
  const systems:SearchHit[]=vehicle.content.systems.filter(s=>normalise(s.name+' '+s.category).includes(q)).map(s=>({kind:'system',id:s.id,name:s.name}));
  const pieces=index.filter(x=>x.haystack.includes(q)).sort((a,b)=>a.label.length-b.label.length).slice(0,80);
  const byName=Object.fromEntries(vehicle.content.systems.map(s=>[s.id,s.name]));
  return [...systems,...pieces.map(x=>({kind:'piece' as const,piece:x.p,label:x.label,systemId:x.systemId,systemName:byName[x.systemId]||x.systemId}))];
 },[query,index,vehicle]);
 useEffect(()=>{setActive(0)},[query]);
 const groups=useMemo(()=>{const m=new Map<string,SearchHit[]>();for(const h of hits){const k=h.kind==='system'?'__systems':h.systemName;(m.get(k)||m.set(k,[]).get(k)!).push(h)}return m},[hits]);
 const onKey=(e:React.KeyboardEvent)=>{if(e.key==='ArrowDown'){e.preventDefault();setActive(a=>Math.min(hits.length-1,a+1))}else if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(0,a-1))}else if(e.key==='Enter'&&hits[active]){e.preventDefault();onPick(hits[active])}else if(e.key==='Escape'){onClose()}};
 let i=-1;
 return <section className="search-panel floating-panel" aria-label={t.search}>
  <div className="panel-heading"><h2>{t.search}</h2><button className="icon-button" onClick={onClose} aria-label={t.closeSearch}><X size={15}/></button></div>
  <label className="search-field"><SearchIcon size={15}/><input ref={input} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={onKey} placeholder={t.searchPlaceholder} aria-label={t.search} role="combobox" aria-expanded={hits.length>0} aria-controls="search-results" aria-activedescendant={hits[active]?`hit-${active}`:undefined} autoComplete="off"/></label>
  <div className="search-results" id="search-results" role="listbox" aria-label={t.searchResults}>
   {query.trim()&&!hits.length&&<p className="search-empty">{t.searchEmpty}</p>}
   {[...groups.entries()].map(([group,list])=><div key={group} className="search-group">{group!=='__systems'&&<span className="search-group-name">{group}</span>}
    {list.map(h=>{i++;const idx=i;return <button key={h.kind==='system'?'s-'+h.id:h.piece.id} id={`hit-${idx}`} role="option" aria-selected={idx===active} className={'search-hit '+(idx===active?'active':'')+(h.kind==='system'?' is-system':'')} onMouseEnter={()=>setActive(idx)} onClick={()=>onPick(h)}>
     {h.kind==='system'?<><strong>{h.name}</strong><small>{t.systems}</small></>:<><span>{h.label}</span><small>{h.piece.faces} {t.faces}</small></>}
    </button>})}
   </div>)}
  </div>
  <p className="search-note">{t.searchHint}</p>
 </section>;
}
