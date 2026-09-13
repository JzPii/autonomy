import {LANGS,UI,type Lang} from './i18n/ui';
export default function LangToggle({lang,setLang,className=''}:{lang:Lang;setLang:(l:Lang)=>void;className?:string}){
 return <div className={'lang-toggle '+className} role="group" aria-label={UI[lang].language}>
  {LANGS.map(l=><button key={l} className={l===lang?'active':''} aria-pressed={l===lang} onClick={()=>setLang(l)}>{l.toUpperCase()}</button>)}
 </div>;
}
