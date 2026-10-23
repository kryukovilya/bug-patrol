'use client';
import {useEffect} from 'react';
import type {RefObject} from 'react';

/** Fit the active mobile editor above both resizing and overlay keyboards. */
export function useMobileEditor(editor?:RefObject<HTMLTextAreaElement|null>){
 useEffect(()=>{
  const root=document.querySelector<HTMLElement>('.hunt-app');
  if(!root)return;
  const viewport=window.visualViewport;
  let frame=0,wasCompact=false;
  const update=()=>{
   frame=0;
   const height=viewport?.height??window.innerHeight;
   const offsetTop=viewport?.offsetTop??0;
   const mobile=window.innerWidth<1000||window.matchMedia('(pointer:coarse)').matches;
   const keyboardInset=window.innerHeight-height-offsetTop;
   const field=editor?.current??root.querySelector<HTMLTextAreaElement>('.investigation-panel textarea');
   const focused=!!field&&document.activeElement===field;
   // Keep the footer steady between a tap and the keyboard's closing resize.
   const compact=mobile&&!!field&&((focused&&(height<600||keyboardInset>120))||(wasCompact&&keyboardInset>120));
   wasCompact=compact;
   root.dataset.editorCompact=String(compact);
   if(compact){
    root.style.setProperty('--editor-viewport-height',`${height}px`);
    root.style.setProperty('--editor-viewport-top',`${offsetTop}px`);
   }else{
    root.style.removeProperty('--editor-viewport-height');
    root.style.removeProperty('--editor-viewport-top');
   }
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  document.addEventListener('focusin',schedule);
  document.addEventListener('focusout',schedule);
  window.addEventListener('resize',schedule);
  window.addEventListener('orientationchange',schedule);
  viewport?.addEventListener('resize',schedule);
  viewport?.addEventListener('scroll',schedule);
  update();
  return()=>{
   if(frame)cancelAnimationFrame(frame);
   document.removeEventListener('focusin',schedule);
   document.removeEventListener('focusout',schedule);
   window.removeEventListener('resize',schedule);
   window.removeEventListener('orientationchange',schedule);
   viewport?.removeEventListener('resize',schedule);
   viewport?.removeEventListener('scroll',schedule);
   delete root.dataset.editorCompact;
   root.style.removeProperty('--editor-viewport-height');
   root.style.removeProperty('--editor-viewport-top');
  };
 },[editor]);
}
