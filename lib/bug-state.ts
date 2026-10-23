import {caseOrder,cases} from './bug-cases.ts';
import type {CaseId} from './bug-cases';
import type {WorldState,Room,Fragment} from './world-state';
import {connections} from './journey.ts';
import {isEasterEgg} from './easter-eggs.ts';
import type {EasterEggId} from './easter-eggs';
export type Progress={code:string;observed:boolean;solved:boolean;hints:number;attempts:number;verifiedCode?:string};
export type HuntState={version:2;started:boolean;room:Room;delivered:boolean;address:Fragment[];addressHints:number;met:CaseId[];reported:CaseId[];discoveries:EasterEggId[];cases:Record<CaseId,Progress>};
export const finalAddress:Fragment[]=['i','t','dot','mos','kva'];
export const rewardFragments:Record<CaseId,Fragment>={info:'kva',server:'i',gate:'dot',archive:'mos',dispatch:'t'};
export const fragmentOrder:Fragment[]=['mos','dot','t','kva','i'];
export function needsApplication(s:HuntState,id:CaseId){const p=s.cases[id];return (id==='info'||id==='server')&&!p.solved&&p.observed&&p.attempts>0&&p.verifiedCode===p.code;}
export function applyCase(s:HuntState,id:CaseId):HuntState{return nextCase(s)===id&&s.room===id&&needsApplication(s,id)?{...s,cases:{...s.cases,[id]:{...s.cases[id],solved:true}}}:s;}
export function addressCorrect(s:HuntState){return caseOrder.every(id=>s.cases[id].solved&&s.reported.includes(id))&&s.address.join('|')===finalAddress.join('|');}
export function freshHunt():HuntState{return {version:2,started:false,room:'corridor',delivered:false,address:[],addressHints:0,met:[],reported:[],discoveries:[],cases:Object.fromEntries(caseOrder.map(id=>[id,{code:cases[id].starter,observed:false,solved:false,hints:0,attempts:0}])) as Record<CaseId,Progress>};}
export function nextCase(s:HuntState):CaseId|undefined{return caseOrder.find(id=>!s.reported.includes(id));}
export function pendingReport(s:HuntState):CaseId|undefined{return caseOrder.find(id=>s.cases[id].solved&&!s.reported.includes(id));}
export function reportCase(s:HuntState,id:CaseId):HuntState{return nextCase(s)===id&&s.cases[id].solved?{...s,reported:[...s.reported,id]}:s;}
export function canVisit(s:HuntState,room:Room){if(room==='corridor')return true;const index=caseOrder.indexOf(room);return index>=0&&caseOrder.slice(0,index).every(id=>s.reported.includes(id));}
export function travelHunt(s:HuntState,room:Room):HuntState{return s.started&&!s.delivered&&connections[s.room].includes(room)&&canVisit(s,room)?{...s,room}:s;}
export function worldState(s:HuntState,preview?:{id:CaseId;actual:unknown;input?:Record<string,unknown>}):WorldState{
 const repaired=Object.fromEntries(caseOrder.map(id=>[id,s.cases[id].solved])) as WorldState['repaired'];
 if(preview&&preview.id===s.room){
  if(preview.id==='server')repaired.server=preview.actual===true||Number(preview.input?.temperature??95)<=80;
  if(preview.id==='gate')repaired.gate=preview.actual===true;
 }
 return {room:s.room,repaired};
}
export function restoreHunt(value:unknown):HuntState|null{
 if(!value||typeof value!=='object')return null;const s=value as HuntState;
 if(s.version!==2||typeof s.started!=='boolean'||typeof s.delivered!=='boolean'||!Object.keys(connections).includes(s.room)||!s.cases)return null;
 const clean=freshHunt();clean.started=s.started;clean.room=s.room;clean.delivered=s.delivered;
 for(const id of caseOrder){const p=s.cases[id];if(!p||typeof p.code!=='string'||p.code.length>4000||typeof p.solved!=='boolean'||typeof p.observed!=='boolean'||!Number.isInteger(p.hints)||p.hints<0||p.hints>3||!Number.isInteger(p.attempts)||p.attempts<0||p.attempts>100000)return null;
  if(p.solved&&(!p.observed||p.attempts===0))return null;if(p.verifiedCode!==undefined&&(typeof p.verifiedCode!=='string'||p.verifiedCode.length>4000))return null;clean.cases[id]={code:p.code,solved:p.solved,observed:p.observed,hints:p.hints,attempts:p.attempts,...(p.verifiedCode!==undefined?{verifiedCode:p.verifiedCode}:{})};}
 const met=s.met??caseOrder.filter(id=>clean.cases[id].observed||clean.cases[id].solved);
 if(!Array.isArray(met)||met.some(id=>!caseOrder.includes(id))||new Set(met).size!==met.length)return null;clean.met=[...met];
 const reported=s.reported??caseOrder.filter(id=>clean.cases[id].solved);
 if(!Array.isArray(reported)||reported.some((id,index)=>id!==caseOrder[index]||!clean.cases[id].solved))return null;clean.reported=[...reported];
 const discoveries=s.discoveries??[];if(!Array.isArray(discoveries)||discoveries.some(id=>typeof id!=='string'||!isEasterEgg(id))||new Set(discoveries).size!==discoveries.length)return null;clean.discoveries=[...discoveries];
 const address=s.address===undefined?(s.delivered?[...finalAddress]:[]):s.address;
 if(!Array.isArray(address)||address.length>5||new Set(address).size!==address.length||address.some(f=>!finalAddress.includes(f)))return null;
 if(address.some(f=>!clean.reported.some(id=>rewardFragments[id]===f)))return null;clean.address=[...address];
 if(s.addressHints!==undefined&&(!Number.isInteger(s.addressHints)||s.addressHints<0||s.addressHints>3))return null;clean.addressHints=s.addressHints??0;
 let locked=false;for(const id of caseOrder){if(locked&&clean.cases[id].solved)return null;if(!clean.reported.includes(id))locked=true;}
 if(!canVisit(clean,clean.room)||clean.delivered&&!addressCorrect(clean)||!clean.started&&(clean.delivered||caseOrder.some(id=>clean.cases[id].observed||clean.cases[id].solved)))return null;
 return clean;
}
