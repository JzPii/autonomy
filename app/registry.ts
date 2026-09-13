import type {Lang} from './i18n/ui';
export type VehicleType='car'|'scooter'|'motorcycle'|'bicycle'|'truck'|'bus';
export type Dimensions={length:number;width:number;height:number;wheelbase?:number;track?:number};
export type Attribution={title:string;creator:string;creatorUrl?:string;source:string;license:string;licenseUrl:string};
export type ModelMeta={id:string;brand:string;name:string;type:VehicleType;year?:string;tagline?:Record<Lang,string>;powertrain?:string;dimensions:Dimensions;attribution:Attribution;systemFallback?:Record<string,string>;links?:Record<string,string>};
export type System={id:string;name:string;category:string;tag:string;description:string;principle:string;specs:[string,string][];source:string;illustrative?:boolean;explode:[number,number,number];anchor:[number,number,number]};
export type Content={systems:System[];labels?:Record<string,string>;pieces?:Record<string,string>;notes?:string};
export type Piece={id:string;part:string;key:string;side:'L'|'R'|null;end:'F'|'R'|null;source:string;material?:string;center:[number,number,number];size:[number,number,number];faces:number};
export type Variant={file:string;bytes:number;faces:number};
export type Manifest={id:string;file:string;files?:{full:Variant;light?:Variant};version:string;generated:string;lengthMeters:number;bounds:{length:number;height:number;bodyWidth:number};counts:Record<string,number>;objects:Piece[]};
export type Shape={system:string;shape:'box'|'cylinder'|'torus'|'tube';size?:[number,number,number];at?:[number,number,number];radius?:number;tube?:number;length?:number;axis?:'x'|'y'|'z';points?:[number,number,number][];material:'dark'|'silver'|'orange'|'module'|'copper';repeat?:{count:[number,number];step:[number,number]};stack?:{count:number;step:number};mirror?:'x'|'z'|'xz'};
export type Internals={shapes:Shape[]};
export type RegistryEntry={id:string;brand:string;name:string;type:VehicleType;year?:string;tagline?:Record<Lang,string>;powertrain?:string;pieces:number;ready:boolean;thumbnail:string|null;creator:string};
export type Registry={generated:string;vehicles:RegistryEntry[]};
export type Vehicle={meta:ModelMeta;content:Content;manifest:Manifest;internals:Internals|null};

export const base=(import.meta.env?.BASE_URL||'/').replace(/\/$/,'');
export const url=(p:string)=>`${base}/${p.replace(/^\//,'')}`;
async function json<T>(p:string):Promise<T>{const r=await fetch(url(p));if(!r.ok)throw new Error(`${r.status} ${p}`);return r.json() as Promise<T>}
export const loadRegistry=()=>json<Registry>('registry.json');
export async function loadVehicle(id:string,lang:Lang):Promise<Vehicle>{
 const [meta,content,manifest,internals]=await Promise.all([json<ModelMeta>(`models/${id}/model.json`),json<Content>(`models/${id}/content.${lang}.json`),json<Manifest>(`models/${id}/manifest.json`),json<Internals>(`models/${id}/internals.json`).catch(()=>null)]);
 return {meta,content,manifest,internals};
}
/** Map a pipeline part (brakes, exhaust…) onto one of this vehicle's systems. */
export function systemFor(part:string,vehicle:Vehicle):string{
 const ids=new Set(vehicle.content.systems.map(s=>s.id));if(ids.has(part))return part;
 const fb=vehicle.meta.systemFallback?.[part];if(fb&&ids.has(fb))return fb;
 return ids.has('body')?'body':vehicle.content.systems[0].id;
}

export type Quality='full'|'light';
/** Auto quality: light on phones or slow / data-saver connections; override with ?q=full|light. */
export function detectQuality():Quality{
 const q=new URLSearchParams(location.search).get('q');if(q==='full'||q==='light')return q;
 const nav=navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}};
 const slow=nav.connection?.saveData||/(^|-)(2g|3g)$/.test(nav.connection?.effectiveType||'');
 const phone=window.matchMedia('(pointer: coarse)').matches&&Math.min(innerWidth,innerHeight)<=820;
 return slow||phone?'light':'full';
}
export function variantFile(m:Manifest,q:Quality){return (q==='light'&&m.files?.light)?m.files.light.file:(m.files?.full.file||m.file)}
