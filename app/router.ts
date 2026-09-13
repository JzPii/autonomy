import {base} from './registry';
/** First path segment under the base is the vehicle id; none means the gallery. */
export function currentVehicleId():string|null{
 const rel=location.pathname.slice(base.length).replace(/^\/+|\/+$/g,'');
 const seg=rel.split('/')[0];return seg&&seg!=='index.html'?seg:null;
}
export function vehicleHref(id:string,lang?:string){return `${base}/${id}/${lang?`?lang=${lang}`:''}`}
export function galleryHref(lang?:string){return `${base}/${lang?`?lang=${lang}`:''}`}
