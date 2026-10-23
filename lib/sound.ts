export type Sound='tap'|'step'|'take'|'error'|'door'|'power'|'frog'|'send'|'delivered'|'bell';
let context:AudioContext|undefined,master:GainNode|undefined,musicBus:GainNode|undefined;
let enabled=true,musicWanted=false,musicDucked=false,timer:ReturnType<typeof setInterval>|undefined,nextBeat=0,beat=0;
const melody=[62,null,65,69,68,null,65,62,57,null,60,64,65,null,64,60,62,null,65,69,72,69,68,65,62,null,57,60,61,null,57,null];
const frequency=(midi:number)=>440*2**((midi-69)/12);
function tone(f:number,at:number,duration:number,type:OscillatorType,volume:number,end=f,bus=master){
 if(!context||!bus)return;const oscillator=context.createOscillator(),gain=context.createGain();
 oscillator.type=type;oscillator.frequency.setValueAtTime(f,at);oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+duration);
 gain.gain.setValueAtTime(.0001,at);gain.gain.linearRampToValueAtTime(volume,at+.009);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
 oscillator.connect(gain);gain.connect(bus);oscillator.start(at);oscillator.stop(at+duration+.03);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
}
function stopMusic(){if(timer)clearInterval(timer);timer=undefined;}
function startMusic(){
 if(timer||!context||!enabled||!musicWanted||document.hidden)return;
 nextBeat=context.currentTime+.07;
 const schedule=()=>{if(!context||context.state!=='running')return;while(nextBeat<context.currentTime+.18){const pitch=melody[beat%melody.length];if(pitch!==null)tone(frequency(pitch),nextBeat,.23,'triangle',.11,frequency(pitch),musicBus);if(beat%4===0)tone(frequency(beat%32<16?38:45),nextBeat,.38,'sine',.14,frequency(beat%32<16?38:45),musicBus);beat++;nextBeat+=.32;}};
 schedule();timer=setInterval(schedule,80);
}
export function unlockAudio(){
 try{if(!context){context=new AudioContext();master=context.createGain();master.gain.value=enabled?1:0;master.connect(context.destination);musicBus=context.createGain();musicBus.gain.value=musicDucked?.28:.7;musicBus.connect(master);document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMusic();void context?.suspend();}else if(enabled){void context?.resume().then(startMusic);}});}void context.resume().then(startMusic);}catch{}
}
export function setAudioEnabled(value:boolean){enabled=value;if(master&&context)master.gain.setTargetAtTime(value?1:0,context.currentTime,.025);if(value)startMusic();else stopMusic();}
export function setMusicActive(value:boolean){musicWanted=value;if(value)startMusic();else stopMusic();}
export function setMusicDucked(value:boolean){musicDucked=value;if(musicBus&&context)musicBus.gain.setTargetAtTime(value?.28:.7,context.currentTime,.18);}
export function playSound(sound:Sound){
 if(!enabled||!context||context.state!=='running')return;const now=context.currentTime;
 const note=(f:number,delay:number,duration:number,type:OscillatorType='sine',volume=.09,end=f)=>tone(f,now+delay,duration,type,volume,end);
 switch(sound){
  case 'tap':note(660,0,.05,'triangle',.07);break;
  case 'step':note(135,0,.065,'triangle',.055,65);break;
  case 'take':note(660,0,.13);note(990,.07,.2);break;
  case 'error':note(180,0,.19,'triangle',.09,95);break;
  case 'door':note(200,0,.3,'triangle',.075,470);note(660,.19,.1);break;
  case 'power':note(70,0,.65,'sawtooth',.055,240);note(880,.5,.22);break;
  case 'frog':note(175,0,.2,'sawtooth',.075,70);note(140,.19,.25,'sawtooth',.07,60);break;
  case 'bell':note(1175,0,.6,'sine',.1);note(1762,0,.5,'sine',.04);break;
  case 'send':note(880,0,.14,'sine',.09);note(120,.65,2,'triangle',.06,180);note(260,3.05,.65,'triangle',.12,1600);break;
  case 'delivered':[523,659,784,1047].forEach((f,i)=>note(f,i*.13,.38));break;
 }
}
