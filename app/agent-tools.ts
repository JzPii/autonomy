import {parts,type PartId} from './parts';

export type StudioActions={select:(id:PartId)=>void;setExplode:(value:number)=>void;setIsolated:(value:boolean)=>void};
type ModelContext={registerTool:(tool:unknown,options:{signal:AbortSignal})=>unknown};

/**
 * Đăng ký công cụ WebMCP (document.modelContext) để trợ lý trong trình duyệt điều khiển studio.
 * Trả về hàm hủy; nếu trình duyệt không hỗ trợ thì không làm gì.
 */
export function registerStudioTools(actions:StudioActions):()=>void {
 const context=(document as Document & {modelContext?:ModelContext}).modelContext;
 if(!context?.registerTool)return()=>{};
 const lifecycle=new AbortController();
 try {
  Promise.resolve(context.registerTool({
   name:'explore_vehicle_component',
   description:'Chọn một hệ thống của VinFast VF 9, đặt mức tách rời (0-100) và tùy chọn cô lập nó trong studio 3D. Select a VF 9 system, set its exploded view and optionally isolate it.',
   inputSchema:{type:'object',properties:{component:{type:'string',enum:parts.map(p=>p.id)},explosion:{type:'number',minimum:0,maximum:100},isolate:{type:'boolean'}},required:['component'],additionalProperties:false},
   annotations:{readOnlyHint:false,untrustedContentHint:false},
   execute(input:unknown){
    const v=input as {component:PartId;explosion?:number;isolate?:boolean};
    const validExplosion=v?.explosion===undefined||(typeof v.explosion==='number'&&Number.isFinite(v.explosion)&&v.explosion>=0&&v.explosion<=100);
    const validIsolate=v?.isolate===undefined||typeof v.isolate==='boolean';
    if(!v||!parts.some(p=>p.id===v.component)||!validExplosion||!validIsolate)throw new Error('Chọn một hệ thống hợp lệ và mức tách rời từ 0 đến 100.');
    actions.select(v.component);
    if(v.explosion!==undefined)actions.setExplode(v.explosion);
    if(v.isolate!==undefined)actions.setIsolated(v.isolate);
    const part=parts.find(p=>p.id===v.component)!;
    return {component:part.id,name:part.name,description:part.description};
   }
  },{signal:lifecycle.signal})).catch(()=>{});
 } catch {}
 return()=>lifecycle.abort();
}
