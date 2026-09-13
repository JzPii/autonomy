import {useEffect,useState} from 'react';
import {LANGS,type Lang} from './i18n/ui';
const KEY='autonomy.lang';
export function detectLang():Lang{
 const q=new URLSearchParams(location.search).get('lang');if(q&&LANGS.includes(q as Lang))return q as Lang;
 try{const s=localStorage.getItem(KEY);if(s&&LANGS.includes(s as Lang))return s as Lang}catch{}
 return navigator.language?.toLowerCase().startsWith('vi')?'vi':'en';
}
export function useLang():[Lang,(l:Lang)=>void]{
 const [lang,set]=useState<Lang>(()=>detectLang());
 useEffect(()=>{document.documentElement.lang=lang;try{localStorage.setItem(KEY,lang)}catch{}
  const u=new URL(location.href);if(u.searchParams.get('lang')!==lang){u.searchParams.set('lang',lang);history.replaceState(null,'',u)}},[lang]);
 return [lang,set];
}
