import type {PartId} from './parts';
export type ManifestPiece={id:string;part:PartId;label:string;center:[number,number,number];size:[number,number,number];faces:number};
export type Manifest={model:string;file:string;version:string;creator:string;source:string;license:string;licenseUrl:string;placeholder:boolean;lengthMeters:number;generated:string;objects:ManifestPiece[]};
export const manifestUrl='/models/vf9-manifest.json';
