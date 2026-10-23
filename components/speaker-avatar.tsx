import {Bird,Clock3,Coffee,Router,Flame,BookOpen,Mail,Bell,Shell} from 'lucide-react';
import {FrogAvatar} from './frog-avatar';

export function SpeakerAvatar({id}:{id:string}){
 if(id==='archive'||id==='frog')return <span className="speaker-avatar frog"><FrogAvatar/></span>;
 const role=({info:'bot',server:'engineer',gate:'guard',dispatch:'postman'} as Record<string,string>)[id]??id;
 const Icon=({pigeon:Bird,clock:Clock3,coffee:Coffee,router:Router,extinguisher:Flame,book:BookOpen,mailbox:Mail,bell:Bell,snail:Shell} as Record<string,typeof Bird>)[role];
 if(Icon)return <span className={'speaker-avatar prop '+role} aria-hidden="true"><Icon size={27} strokeWidth={1.7}/></span>;
 const uniform=role==='engineer'?'#d4a34d':role==='postman'?'#42769b':role==='guard'?'#263f46':'#4b7775';
 return <span className={'speaker-avatar robot '+role}><svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <path d="M8 60 13 47 34 43 54 49 59 60Z" fill="#132e35"/>
  <path d="m15 48 17-6 17 6v14H15Z" fill={uniform}/><path d="m49 48 7 5v9h-7Z" fill="#19353c"/>
  <path d="m10 19 36-5 11 7v26l-35 6-12-8Z" fill="#b4996d"/>
  <path d="m10 19 36-5 11 7-35 6Z" fill="#f5dfb0"/><path d="m10 19 12 8v26l-12-8Z" fill="#aa9066"/>
  <path d="m22 27 35-6v26l-35 6Z" fill="#e6cea0"/>
  <path d="m25 29 29-5v17l-29 5Z" fill="#102d35"/>
  <path d="m29 32 6-1v5l-6 1Zm14-2 6-1v5l-6 1Z" fill="#a7ead0"/>
  <path d="m34 40 11-2" stroke="#a7ead0" strokeWidth="2" strokeLinecap="round"/>
  {role==='bot'&&<><path d="m12 18 0-4 7-1v5Z" fill="#233e43"/><path d="M35 33a6 6 0 1 1-12 2 6 6 0 0 1 12-2Zm18-3a6 6 0 1 1-12 2 6 6 0 0 1 12-2Z" stroke="#c39353" strokeWidth="2"/><path d="m35 34 6-1" stroke="#c39353" strokeWidth="2"/><path d="m29 53 7 2-6 5Zm13-2-6 4 7 3Z" fill="#cc7857"/></>}
  {role==='engineer'&&<><path d="M10 21 13 11 34 5 49 9 57 19 21 26Z" fill="#edbc5d"/><path d="m9 21 13 7 37-6-2-5-35 6Z" fill="#c68f3c"/><path d="m30 8 6-2 6 15-6 1Z" fill="#ffdb83"/><path d="m24 51 5-1v12h-5Zm16-1 5-1v13h-5Z" fill="#e6e7cd"/></>}
  {(role==='guard'||role==='postman')&&<><path d="m9 19 1-9 35-6 12 8v8l-35 6Z" fill={uniform}/><path d="m20 22 36-6 6 5-37 7-9-2Z" fill={role==='guard'?'#142d35':'#2e5879'}/><path d="m33 11 10-2v7l-10 2Z" fill="#e3bc6d"/>{role==='guard'?<path d="m38 52 5-2 5 2-1 6-4 3-4-2Z" fill="#e9bc65"/>:<path d="m33 52 14-2v9l-14 2Zm0 0 7 4 7-6" stroke="#f1ddb1" strokeWidth="1.5"/>}</>}
 </svg></span>;
}
