const ease=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
export function mailMotion(progress:number){
 const t=Math.max(0,Math.min(1,progress));
 return {x:1.05+2.4*ease((t-.18)/.65),y:1.56,z:-1,visible:t<.83,scan:Math.sin(Math.min(1,t/.18)*Math.PI),pressure:ease((t-.78)/.22)};
}
