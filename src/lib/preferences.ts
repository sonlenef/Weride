import {useEffect,useState} from 'react';
export type Density='compact'|'comfortable';
const read=():Density=>{try{return localStorage.getItem('weride.density')==='compact'?'compact':'comfortable';}catch{return 'comfortable';}};
export function useDensity():[Density,(value:Density)=>void]{
  const [density,setDensity]=useState<Density>(read);
  useEffect(()=>{document.body.dataset.density=density;},[density]);
  useEffect(()=>{const change=(event:Event)=>setDensity((event as CustomEvent<Density>).detail||read());window.addEventListener('weride:density',change);return()=>window.removeEventListener('weride:density',change);},[]);
  const change=(value:Density)=>{setDensity(value);try{localStorage.setItem('weride.density',value);}catch{/* Preference still applies in memory. */}window.dispatchEvent(new CustomEvent('weride:density',{detail:value}));};
  return [density,change];
}
export function safeReturnTo(value:unknown,fallback='/requirements'):string {
  return typeof value==='string'&&/^\/(requirements|system|questions|search|sources)([/?#]|$)/.test(value)?value:fallback;
}
export function rememberScroll(url:string){try{sessionStorage.setItem('weride.scroll:'+url,String(window.scrollY));}catch{/* Navigation remains available. */}}
export function readScroll(url:string):number {try{const y=Number(sessionStorage.getItem('weride.scroll:'+url)||0);return Number.isFinite(y)&&y>=0?y:0;}catch{return 0;}}
