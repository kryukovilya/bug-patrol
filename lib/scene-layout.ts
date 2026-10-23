import type {Room} from './world-state';
import type {Obstacle} from './walking';
export type SceneTarget={id:string;label:string;x:number;z:number;height?:number;approach?:{x:number;z:number}};
export const targets:Record<Room,SceneTarget[]>={
 corridor:[{id:'info',label:'Справочная',x:-2.7,z:-2.5,height:3.65,approach:{x:-2.7,z:-.9}},{id:'server',label:'Серверная',x:0,z:-2.5,height:3.65,approach:{x:0,z:-.9}},{id:'gate',label:'Охрана',x:2.7,z:-2.5,height:3.65,approach:{x:2.7,z:-.9}},{id:'dispatch',label:'Почта',x:4.2,z:.1,height:3.65,approach:{x:2.7,z:.1}}],
 info:[{id:'bot',label:'РЕГ-01',x:-2,z:-1.3,height:2.5},{id:'reset',label:'Перезапуск бота',x:3.1,z:-3.1,height:1.8,approach:{x:2.65,z:-2.25}}],
 server:[{id:'engineer',label:'Термос',x:-2.5,z:.2,height:3.1},{id:'fan',label:'Охлаждение',x:2.5,z:-3.1,height:3,approach:{x:2.05,z:-2.25}}],
 gate:[{id:'guard',label:'Капитан Точка',x:-2,z:.1,height:3.1},{id:'gate',label:'Архив',x:1.7,z:-2,height:3.7,approach:{x:1.7,z:-.6}}],
 archive:[{id:'cabinet',label:'Картотека',x:-2.3,z:-1.7,height:2.4},{id:'frog',label:'Кваксильда',x:2.5,z:.8,height:2.65}],
 dispatch:[{id:'terminal',label:'Терминал',x:0,z:-1,height:2.3},{id:'postman',label:'Пиксель',x:-2.5,z:-.7,height:2.7}]
};

// Footprints match the furniture and characters rendered by WorldScene.
export const roomObstacles: Record<Room, Obstacle[]> = {
 corridor: [{x:-2.7,z:-2.5,w:1.95,d:.5},{x:0,z:-2.5,w:1.95,d:.5},{x:2.7,z:-2.5,w:1.95,d:.5},{x:4.35,z:.1,w:.3,d:1.95},{x:-3.72,z:1.6,w:.5,d:.5}],
 info: [{x:-2,z:-1.3,w:1.5,d:1},{x:-2,z:-.25,w:2.4,d:.8},{x:1,z:-.7,w:1.35,d:1.15},{x:3.1,z:-3.4,w:1.1,d:.5}],
 server: [{x:-2.5,z:.2,w:1.5,d:1},{x:-3.65,z:.5,w:.58,d:.56},{x:-.6,z:-2,w:2.65,d:1.2},{x:2.5,z:-3.4,w:2.6,d:.55}],
 gate: [{x:-2,z:.1,w:1.5,d:1},{x:1.7,z:-2.2,w:2.75,d:.9},{x:2.5,z:1,w:1.35,d:1.15}],
 archive: [{x:-.85,z:-1.7,w:4.5,d:1.2},{x:-2.4,z:1,w:.84,d:.84},{x:2.5,z:.8,w:1.6,d:1.4}],
 dispatch: [{x:0,z:-.75,w:2.55,d:1.8},{x:-2.5,z:-.7,w:1.5,d:1},{x:2.4,z:-1.1,w:2,d:1.25}]
};

for(const room of Object.keys(targets) as Room[])if(room!=='corridor')targets[room].push({id:'exit',label:'Выход',x:-4.2,z:2.55,height:2.5,approach:{x:-2.9,z:2.75}});
targets.info.push({id:'clock',label:'Часы приёма',x:-2.7,z:-3.4,height:3.3,approach:{x:0,z:1.5}});
targets.server.push({id:'coffee',label:'Кофе 404',x:-3.65,z:.5,height:1.2,approach:{x:-2.5,z:1.8}});
targets.gate.push({id:'snail',label:'Экспресс',x:2.8,z:1.17,height:2.5,approach:{x:2.5,z:2.6}});
targets.corridor.push({id:'pigeon',label:'Облако',x:-3.72,z:1.6,height:3,approach:{x:-2.2,z:1.3}});

targets.corridor.push({id:'router',label:'Wi-Fi',x:-4.08,z:-.5,height:3.2,approach:{x:-2.6,z:-.5}});
targets.server.push({id:'extinguisher',label:'Огнетушитель',x:-3.8,z:-2.1,height:1.8,approach:{x:-2.5,z:1.8}});
targets.archive.push({id:'book',label:'README',x:.5,z:-1.65,height:3.15,approach:{x:.5,z:.2}});
targets.dispatch.push({id:'bell',label:'Звонок',x:1.04,z:-.12,height:2.5,approach:{x:1.1,z:1.7}},{id:'mailbox',label:'Спам',x:-1.4,z:-3.2,height:3.2,approach:{x:-1.8,z:1.3}});
