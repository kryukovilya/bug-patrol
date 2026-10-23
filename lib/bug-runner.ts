import type {CaseId} from './bug-cases';
export type LogEntry={text:string;line:number};
export type TrialResult={name:string;input:Record<string,unknown>;expected:unknown;actual:unknown;pass:boolean;logs:LogEntry[];events?:string[];error?:string;explanation:string};
export type RunResult={results:TrialResult[];error?:string;source?:string};
// Executed in a disposable worker: loops never block the game or the editor.
export const workerSource=String.raw`
const boot=async function(payload){
 const {id,source,trials}=payload;
 if(typeof source!=='string'||source.length>4000)return {results:[],error:'Код слишком длинный. Для этого задания достаточно нескольких строк.'};
 if(/\b(?:import|fetch|XMLHttpRequest|WebSocket|globalThis|self|window|document|Function|eval|constructor|prototype|__proto__|postMessage|Worker|setInterval|setTimeout)\b/.test(source))return {results:[],error:'Используй команды из задания: они уже подключены к комнате.'};
 let fn;try{fn=new (Object.getPrototypeOf(async function(){}).constructor)('attempts','temperature','hasPass','hasBan','files','say','turnOnCooling','openGate','showFile','sendParcel','markDelivered','"use strict";\n'+source);}catch(e){return {results:[],error:'В коде ошибка записи: '+e.message+'. Проверь скобки и знаки. Кваксильда поможет.'};}
 const results=[];
 for(const trial of trials){
  const input=trial.input,logs=[];let spoken=0,fan=false,gate=false,shown=[],events=[],delivery=false,ack=false,pending=[];
  const lineFor=name=>Math.max(1,source.split('\n').findIndex(s=>s.includes(name+'('))+1);
  const log=(text,name)=>{if(logs.length<16)logs.push({text,line:name?lineFor(name):0});};
  log('Вход: '+Object.entries(input).filter(([k])=>k!=='delay').map(([k,v])=>k+' = '+JSON.stringify(v)).join(', '));
  const say=text=>{spoken++;log('say → '+text,'say');};
  const turnOnCooling=()=>{fan=true;log('turnOnCooling → вентилятор включён','turnOnCooling');};
  const openGate=()=>{gate=true;log('openGate → дверь открыта','openGate');};
  const showFile=file=>{shown.push(file===undefined?'[нет файла]':file);log('индекс '+(input.files||[]).indexOf(file)+'; showFile → '+(file===undefined?'нет файла по этому индексу':file),'showFile');};
  const sendParcel=()=>{events.push('send');log('sendParcel → пакет отправлен, ждём ответ','sendParcel');const task=new Promise(resolve=>setTimeout(()=>{ack=true;events.push('ack');log('Ответ почты: '+(input.accepted?'принято':'отказ'));resolve(input.accepted);},input.delay));pending.push(task);return task;};
  const markDelivered=()=>{delivery=true;events.push('delivered');log('markDelivered → '+(ack?'отмечена доставка':'ОШИБКА: ответа ещё нет'),'markDelivered');};
  let error;try{await fn(input.attempts,input.temperature,input.hasPass,input.hasBan,input.files||[],say,turnOnCooling,openGate,showFile,sendParcel,markDelivered);await Promise.all(pending);}catch(e){error=e.message;log('Ошибка выполнения: '+e.message);}
  const actual=id==='info'?spoken:id==='server'?fan:id==='gate'?gate:id==='archive'?shown:delivery;
  let pass=!error&&JSON.stringify(actual)===JSON.stringify(trial.expected);
  if(id==='dispatch')pass=pass&&events.includes('send')&&events.includes('ack')&&(!delivery||events.indexOf('ack')<events.indexOf('delivered'));
  log('Результат: '+(id==='info'?'приветствий: '+spoken:id==='server'?'вентилятор '+(fan?'включён':'выключен'):id==='gate'?'дверь '+(gate?'открыта':'закрыта'):id==='archive'?JSON.stringify(shown):delivery?'отмечено «Доставлено»':'доставка не отмечена'));
  results.push({...trial,actual,pass,logs,events:id==='dispatch'?[...events]:undefined,error});
 }
 return {results};
};
`;
export function runCode(id:CaseId,source:string,trials:unknown[],signal?:AbortSignal):Promise<RunResult>{
 return new Promise(resolve=>{
  if(typeof Worker==='undefined'){resolve({results:[],error:'Браузер не поддерживает запуск учебного кода. Открой игру в современном браузере.'});return;}
  const url=URL.createObjectURL(new Blob([workerSource+'\nonmessage=async e=>postMessage(await boot(e.data));'],{type:'text/javascript'}));
  let worker:Worker;try{worker=new Worker(url);}catch{URL.revokeObjectURL(url);resolve({results:[],error:'Запуск кода заблокирован браузером. Разреши локальные скрипты для игры.'});return;}
  let finished=false;const finish=(r:RunResult)=>{if(finished)return;finished=true;clearTimeout(timer);worker.terminate();URL.revokeObjectURL(url);signal?.removeEventListener('abort',abort);resolve(r);};
  const timer=setTimeout(()=>finish({results:[],error:'Выполнение остановлено: код слишком долго не завершался. Проверь условие цикла или вызови Кваксильду.'}),1500);
  const abort=()=>finish({results:[],error:'Проверка остановлена.'});signal?.addEventListener('abort',abort,{once:true});
  worker.onmessage=e=>finish(e.data);worker.onerror=()=>finish({results:[],error:'Не удалось выполнить код. Проверь запись и попробуй ещё раз.'});
  if(signal?.aborted){abort();return;}worker.postMessage({id,source,trials});
 });
}
