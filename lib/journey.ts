import type {Room} from './world-state';
export const connections:Record<Room,Room[]>={corridor:['info','server','gate','dispatch'],info:['corridor'],server:['corridor'],gate:['corridor','archive'],archive:['gate'],dispatch:['corridor']};
export function roomRoute(from:Room,to:Room):Room[]{
 const queue:{room:Room;path:Room[]}[]=[{room:from,path:[]}],seen=new Set<Room>([from]);
 for(const node of queue){if(node.room===to)return node.path;for(const room of connections[node.room])if(!seen.has(room)){seen.add(room);queue.push({room,path:[...node.path,room]});}}
 return [];
}
export function nextDoor(from:Room,to:Room):string|null{const next=roomRoute(from,to)[0];if(!next)return null;return from==='corridor'?next:from==='gate'&&next==='archive'?'gate':'exit';}
