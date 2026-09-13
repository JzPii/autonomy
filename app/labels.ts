import {LABELS,PIECE_NOTES} from './i18n/labels';
import {UI,type Lang} from './i18n/ui';
import type {Piece,Vehicle} from './registry';
export function pieceLabel(p:Piece,lang:Lang,vehicle?:Vehicle|null){
 const t=UI[lang];const dict=LABELS[lang];
 const name=vehicle?.content.labels?.[p.key]||dict[p.key]||dict[p.key.split('.')[0]]||t.unknownPiece;
 const mods=[p.side?(p.side==='L'?t.left:t.right):null,p.end?(p.end==='F'?t.front:t.rear):null].filter(Boolean);
 return mods.length?`${name} · ${mods.join(' · ')}`:name;
}
export function pieceNote(p:Piece,lang:Lang,vehicle?:Vehicle|null){
 return vehicle?.content.pieces?.[p.key]||PIECE_NOTES[lang][p.key]||PIECE_NOTES[lang][p.key.split('.')[0]]||UI[lang].pieceFallback;
}
