import {useEffect,useState} from 'react';
import Gallery from './gallery';
import Studio from './page';
import {useLang} from './lang';
import {loadRegistry,type Registry} from './registry';
import {currentVehicleId} from './router';

export default function App(){
 const [lang,setLang]=useLang();
 const [registry,setRegistry]=useState<Registry|null>(null);const [registryError,setRegistryError]=useState(false);
 useEffect(()=>{loadRegistry().then(setRegistry).catch(()=>setRegistryError(true))},[]);
 const id=currentVehicleId();
 if(!id)return <Gallery lang={lang} setLang={setLang} registry={registry} error={registryError}/>;
 return <Studio id={id} lang={lang} setLang={setLang} registry={registry}/>;
}
