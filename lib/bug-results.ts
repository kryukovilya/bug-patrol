import type {CaseId} from './bug-cases';
import type {TrialResult} from './bug-runner';

// Delivery is judged by event order as well as its final boolean value.
export function resultText(id:CaseId,trial:TrialResult,expected=false):string{
 const value=expected?trial.expected:trial.actual;
 if(id==='info')return `Приветствий: ${value}`;
 if(id==='server')return value?'Вентилятор включён':'Вентилятор выключен';
 if(id==='gate')return value?'Дверь открыта':'Дверь закрыта';
 if(id==='archive')return Array.isArray(value)?value.length?value.join(', '):'Пусто':'Ошибка';
 if(expected)return value?'Ответ почты → «Доставлено»':'Отказ почты → без отметки';
 const events=trial.events??[],ack=events.indexOf('ack'),marked=events.indexOf('delivered');
 const response=trial.input.accepted===false?'Отказ почты':'Ответ почты';
 if(marked>=0){
  if(ack<0)return '«Доставлено» без ответа почты';
  return marked<ack?`«Доставлено» → ${response.toLowerCase()}`:`${response} → «Доставлено»`;
 }
 if(ack>=0)return `${response} → без отметки`;
 return 'Ответ почты не получен';
}

export function quickEditsFor<T>(id:CaseId,edits:readonly T[]):T[]{
 // Keep the introductory choice stable; later cases do not reward repeating
 // the first button. Stable positions also prevent buttons moving on edits.
 return id==='server'||id==='archive'?[...edits].reverse():[...edits];
}
