import type {Lang} from './i18n/ui';
import {pieceLabel} from './labels';
import type {Vehicle} from './registry';
export type StudioActions={select:(systemId:string)=>void;inspect:(pieceId:string)=>void;setExplode:(value:number)=>void;setIsolated:(value:boolean)=>void};
type ModelContext={registerTool:(tool:unknown,options:{signal:AbortSignal})=>unknown};
/** WebMCP (document.modelContext): let an in-browser assistant drive the studio. No-op where unsupported. */
export function registerStudioTools(vehicle:Vehicle,lang:Lang,actions:StudioActions):()=>void {
 const context=(document as Document & {modelContext?:ModelContext}).modelContext;
 if(!context?.registerTool)return()=>{};
 const lifecycle=new AbortController();const systems=vehicle.content.systems;const name=`${vehicle.meta.brand} ${vehicle.meta.name}`;
 const tools=[
  {name:'explore_vehicle_component',description:`Select a system of the ${name}, set its exploded view (0-100) and optionally isolate it. Chọn một hệ thống, đặt mức tách rời và tùy chọn cô lập.`,
   inputSchema:{type:'object',properties:{component:{type:'string',enum:systems.map(s=>s.id)},explosion:{type:'number',minimum:0,maximum:100},isolate:{type:'boolean'}},required:['component'],additionalProperties:false},
   annotations:{readOnlyHint:false,untrustedContentHint:false},
   execute(input:unknown){const v=input as {component:string;explosion?:number;isolate?:boolean};
    const okE=v?.explosion===undefined||(typeof v.explosion==='number'&&Number.isFinite(v.explosion)&&v.explosion>=0&&v.explosion<=100);
    if(!v||!systems.some(s=>s.id===v.component)||!okE||(v.isolate!==undefined&&typeof v.isolate!=='boolean'))throw new Error('Choose a valid component and an explosion value between 0 and 100.');
    actions.select(v.component);if(v.explosion!==undefined)actions.setExplode(v.explosion);if(v.isolate!==undefined)actions.setIsolated(v.isolate);
    const s=systems.find(x=>x.id===v.component)!;return {component:s.id,name:s.name,description:s.description}}},
  {name:'find_structure',description:`Find pieces or systems of the ${name} by name in English or Vietnamese. Returns up to 30 matches with ids usable by inspect_structure. Tìm chi tiết theo tên.`,
   inputSchema:{type:'object',properties:{query:{type:'string',minLength:1}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:true},
   execute(input:unknown){const q=String((input as {query?:unknown})?.query??'').trim().toLowerCase();if(!q)throw new Error('Provide a query.');
    const hits=vehicle.manifest.objects.map(p=>({id:p.id,system:p.part,label:pieceLabel(p,lang,vehicle),alt:pieceLabel(p,lang==='vi'?'en':'vi',vehicle)})).filter(p=>p.label.toLowerCase().includes(q)||p.alt.toLowerCase().includes(q)).slice(0,30);
    const sys=systems.filter(s=>s.name.toLowerCase().includes(q)).map(s=>({id:s.id,name:s.name}));return {systems:sys,pieces:hits}}},
  {name:'inspect_structure',description:`Select a piece of the ${name} by id (from find_structure), open its details and isolate it. Chọn và cô lập một chi tiết.`,
   inputSchema:{type:'object',properties:{id:{type:'string'},isolate:{type:'boolean'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false},
   execute(input:unknown){const v=input as {id:string;isolate?:boolean};const p=vehicle.manifest.objects.find(x=>x.id===v?.id);if(!p)throw new Error('Unknown piece id.');
    actions.inspect(p.id);actions.setIsolated(v.isolate??true);return {id:p.id,label:pieceLabel(p,lang,vehicle),system:p.part}}},
 ];
 for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}}
 return()=>lifecycle.abort();
}
