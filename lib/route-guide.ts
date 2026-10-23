import {targets,roomObstacles} from './scene-layout.ts';
import {walkingPath} from './walking.ts';
import type {Point} from './walking';
import type {Room} from './world-state';

export function routeGuidance(room:Room,from:Point,id:string|null|undefined){
 const target=targets[room].find(t=>t.id===id);
 if(!target)return {markers:[],end:null};
 const goal=target.approach??{x:target.x,z:target.z+1.2};
 const path=[{...from},...walkingPath(from,goal,9,roomObstacles[room])];
 const lengths=path.slice(1).map((p,i)=>Math.hypot(p.x-path[i].x,p.z-path[i].z));
 const total=lengths.reduce((sum,n)=>sum+n,0),markers:{x:number;z:number;heading:number}[]=[];
 for(let distance=.55;distance<total-.15&&markers.length<64;distance+=.45){
  let remaining=distance;
  for(let i=0;i<lengths.length;i++){if(remaining>lengths[i]){remaining-=lengths[i];continue;}const a=path[i],b=path[i+1],t=remaining/lengths[i];markers.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,heading:Math.atan2(b.x-a.x,b.z-a.z)});break;}
 }
 return {markers,end:path.at(-1)!};
}
