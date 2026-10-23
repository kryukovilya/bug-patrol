import {useEffect,useState} from 'react';

export function SmoothText({text,className}:{text:string;className:string}){
 const [content,setContent]=useState({text,previous:''});
 if(content.text!==text)setContent({text,previous:content.text});
 useEffect(()=>{const timer=setTimeout(()=>setContent(s=>s.text===text&&s.previous?{...s,previous:''}:s),240);return()=>clearTimeout(timer);},[text]);
 return <div className={'smooth-text '+className} aria-live="polite">{content.previous&&<span className="dialogue-out" aria-hidden="true">{content.previous}</span>}<span key={content.text} className="dialogue-current">{content.text}</span></div>;
}
